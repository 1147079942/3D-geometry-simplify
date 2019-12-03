let FS = require("fs");
let SimplifyGeometry = require("../core/simplifyGeometry.js");

/**
 *
 * @param gltf file content
 * @param quality
 * return new gltf file content
 */
function simplify(gltf, quality) {
    var buffers = [];
    var orgBuffers = [];
    var scenes = gltf["scenes"];
    var nodes = gltf["nodes"];
    var meshes = gltf["meshes"];
    var accessors = gltf["accessors"];
    var bufferViews = gltf["bufferViews"];
    var materials = gltf["materials"];
    var base64DataStart = "data:application/octet-stream;base64,";

    //read buffer
    gltf.buffers.forEach((buffer) => {
        var data = buffer.uri;
        var byteLength = buffer.byteLength;
        var bufferData;
        if (data.startsWith("data")) {
            var newData = data.replace(base64DataStart, "");
            bufferData = new Buffer.from(newData, "base64").subarray(0, byteLength);
        } else {
            bufferData = FS.readFileSync(data);
        }
        buffers.push(bufferData);
        // buffer.uri = null;
        orgBuffers.push(buffer);
    });

    let changedBuffer = [];

    scenes.forEach((scene) => {
        scene.nodes.forEach((nodeIndex) => {
            let node = nodes[nodeIndex];
            let rotation = node.rotation;
            let meshIndex = node.mesh;
            let subMeshes = meshes[meshIndex].primitives;
            subMeshes.forEach((subMesh) => {
                let positionIndex = subMesh.attributes.POSITION;
                let normalIndex = subMesh.attributes.NORMAL;
                let uvIndex = subMesh.attributes.UV;
                let indicesIndex = subMesh.indices;
                let materialIndex = subMesh.material;
                let positionAccessor = accessors[positionIndex];
                let normalAccessor = accessors[normalIndex];
                let uvAccessor = accessors[uvIndex];
                let indicesAccessor = accessors[indicesIndex];
                let indicesType = indicesAccessor.componentType;
                let positionBuffer = getGeometryBuffer(positionAccessor, bufferViews, buffers);
                let indicesBuffer = getGeometryBuffer(indicesAccessor, bufferViews, buffers, indicesType);

                let normalBuffer = normalAccessor ? getGeometryBuffer(normalAccessor, bufferViews, buffers) : [];
                let uvBuffer = uvAccessor ? getGeometryBuffer(uvAccessor, bufferViews, buffers) : [];

                // componentType对应数据类型，除了index其余默认float处理
                let geometryBuffer = new SimplifyGeometry.GeometryBuffer(positionBuffer, normalBuffer, uvBuffer, indicesBuffer, indicesType === 5123);

                let newGeometryBuffer = SimplifyGeometry.runDecimation(geometryBuffer, quality);

                var newPositionBuffer = newGeometryBuffer.position;
                var newIndicesBuffer = newGeometryBuffer.index;
                var newNormalBuffer = newGeometryBuffer.normal;
                var newUvBuffer = newGeometryBuffer.uv;

                positionAccessor.count = newPositionBuffer.length / 12;
                indicesAccessor.count = newIndicesBuffer.length / (indicesType === 5123 ? 2 : 4);
                changedBuffer.push({
                    accessor: positionIndex,
                    bufferViewIndex: positionAccessor.bufferView,
                    bufferIndex: bufferViews[positionAccessor.bufferView].buffer,
                    buffer: newPositionBuffer,
                });
                changedBuffer.push({
                    accessor: indicesIndex,
                    bufferViewIndex: indicesAccessor.bufferView,
                    bufferIndex: bufferViews[indicesAccessor.bufferView].buffer,
                    buffer: newIndicesBuffer,
                });
                if (normalAccessor) {
                    normalAccessor.count = newNormalBuffer.length / 12;
                    changedBuffer.push({
                        accessor: normalIndex,
                        bufferViewIndex: normalAccessor.bufferView,
                        bufferIndex: bufferViews[normalAccessor.bufferView].buffer,
                        buffer: newNormalBuffer,
                    });
                }
                if (uvAccessor) {
                    uvAccessor.count = newUvBuffer.length / 8;
                    changedBuffer.push({
                        accessor: uvIndex,
                        bufferViewIndex: uvAccessor.bufferView,
                        bufferIndex: bufferViews[uvAccessor.bufferView].buffer,
                        buffer: newUvBuffer,
                    });
                }
            })
        })
    });

    changedBuffer.sort((a, b) => {
        // return a.bufferViewIndex - b.bufferViewIndex;
        return a.accessor - b.accessor;
    });

    let newAccessors = [];
    let totalOrgOffset = 0;

    accessors.forEach((accessor, index) => {
        if (changedBuffer[0].accessor === index) {
            let changedB = changedBuffer.shift();
            newAccessors[index] = changedB;
            newAccessors[index].offset = totalOrgOffset;
            totalOrgOffset += changedB.buffer.length;
        } else {
            let bufferView = bufferViews[accessor.bufferView];
            let accessorByteOffset = accessor.byteOffset || 0;
            let buffer = buffers[bufferView.buffer];
            let byteOffset = bufferView.byteOffset || 0;
            let byteLength = bufferView.byteLength;
            let offset = accessorByteOffset + byteOffset;
            newAccessors[index] = {};
            newAccessors[index].accessor = index;
            newAccessors[index].bufferViewIndex = accessor.bufferView;
            newAccessors[index].bufferIndex = bufferViews[accessor.bufferView].buffer;
            newAccessors[index].buffer = buffer.subarray(offset, offset + byteLength);
            newAccessors[index].offset = totalOrgOffset;
            totalOrgOffset += byteLength;
        }
    });

    let bufferViewLength = [];
    newAccessors.forEach((accessor, index) => {
        let bufferViewIndex = accessor.bufferViewIndex;
        let bufferLength = accessor.buffer.length;
        if (!bufferViewLength[bufferViewIndex]) bufferViewLength[bufferViewIndex] = 0;
        accessors[index].byteOffset = bufferViewLength[bufferViewIndex];
        bufferViewLength[bufferViewIndex] += bufferLength;
    });

    let bufferLength = [];
    bufferViews.forEach((bufferView, index) => {
        let bufferIndex = bufferView.buffer;
        if (!bufferLength[bufferIndex]) bufferLength[bufferIndex] = 0;
        bufferViews[index].byteOffset = bufferLength[bufferIndex];
        bufferViews[index].byteLength = bufferViewLength[index];
        bufferLength[bufferIndex] += bufferViewLength[index];
    });

    let newBuffers = [];
    for (let i = 0; i < buffers.length; i++) {
        if (!newBuffers[i]) newBuffers[i] = new Buffer.alloc(0);

        for (let j = 0; j < bufferViews.length; j++) {
            let filterAccessors = newAccessors.filter((accessor) => {
                return accessor.bufferViewIndex === j && accessor.bufferIndex === i;
            });
            filterAccessors.sort((a, b) => {
                return a.offset - b.offset;
            });

            filterAccessors.forEach((accessor) => {
                newBuffers[i] = Buffer.concat([newBuffers[i], accessor.buffer])
            });
        }
    }

    orgBuffers.forEach((buffer, index) => {
        let uri = orgBuffers[index].uri;
        if (uri.startsWith(base64DataStart)) {
            orgBuffers[index].uri = base64DataStart + newBuffers[index].toString("base64");
            orgBuffers[index].byteLength = newBuffers[index].length;
        } else {
            orgBuffers[index].uri = uri + ".simplified";
            FS.writeFileSync(orgBuffers[index].uri, newBuffers[index])
        }
    });

    var result = {};
    for (let key in gltf) {
        result[key] = gltf[key];
    }
    result.accessors = accessors;
    result.bufferViews = bufferViews;
    result.buffers = orgBuffers;
    return result;
}

function getGeometryBuffer(accessor, bufferViews, buffers, indicesType) {
    let bufferViewIndex = accessor.bufferView;
    let bufferView = bufferViews[bufferViewIndex];
    let byteStride = bufferView.byteStride || (indicesType === 5123 ? 2 : 4);
    let bufferViewOffset = accessor.byteOffset;
    let byteLength = accessor.count * byteStride;
    let byteOffset = (bufferView.byteOffset || 0) + bufferViewOffset;
    let buffer = buffers[bufferView.buffer];
    let subarray = buffer.subarray(byteOffset, byteOffset + byteLength);

    return subarray;
}

module.exports = {
    simplify
};