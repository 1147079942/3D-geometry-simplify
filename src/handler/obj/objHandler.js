let loader = require("./OBJLoader");
let exporter = require("./OBJExporter");
let SimplifyGeometry = require("../../core/simplifyGeometry");
let THREE = require("three");
let GeometryBuffer = SimplifyGeometry.GeometryBuffer;
let runDecimation = SimplifyGeometry.runDecimation;

function simplify(obj, quality) {
    let objLoader = new loader.OBJLoader();
    let objExporter = new exporter.OBJExporter();
    let parse = objLoader.parse(obj);
    let result = "";
    parse.children.forEach(mesh => {
        let geometry = mesh.geometry;
        let uint32Array = reBuildIndex(geometry.attributes.position);
        let geometryBuffer = new GeometryBuffer(
            new Buffer.from(geometry.attributes.position.array.buffer),
            new Buffer.from(geometry.attributes.normal.array.buffer),
            new Buffer.from(geometry.attributes.uv.array.buffer),
            new Buffer.from(uint32Array.buffer),
            false);
        let geometryResource = SimplifyGeometry.initGeometry(geometryBuffer);
        runDecimation(geometryResource, quality);
        SimplifyGeometry.rebuildNormal(geometryResource);
        let resultGeometryBuffer = SimplifyGeometry.reconstructBuffer(geometryResource.triangles, false);
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(resultGeometryBuffer.position.buffer, 3));
        geometry.setAttribute("normal", new THREE.Float32BufferAttribute(resultGeometryBuffer.normal.buffer, 3));
        geometry.setAttribute("uv", new THREE.Float32BufferAttribute(resultGeometryBuffer.uv.buffer, 2));
        geometry.setIndex(new THREE.Int32BufferAttribute(resultGeometryBuffer.index.buffer, 1));

        result += objExporter.parse(mesh) + "\n";
    });

    return result;
    // OBJExporter
}

// build index if mesh do not has index and use drawmode 0
function reBuildIndex(position) {
    let uint32Array = new Uint32Array(position.count);
    for (let i = 0; i < uint32Array.length; i++) {
        uint32Array[i] = i;
        uint32Array[i + 1] = i + 1;
        uint32Array[i + 2] = i + 2;
    }
    return uint32Array;
}

module.exports = {
    simplify
};