let THREE = require("three");
let FS = require("fs");

const decimationIterations = 100;
const aggressiveness = 7;
const Vector3 = THREE.Vector3;
Vector3.prototype.toString = function () {
    return "{X: " + this.x + " Y:" + this.y + " Z:" + this.z + "}"
};

/**
 *
 * @param geometryBuffer : GeometryResource
 * @param quality : number
 * @returns {GeometryResource}
 */
function runDecimation(geometryResource, quality) {

    let triangles = geometryResource.triangles;
    let references = geometryResource.references;

    console.log(triangles.length);

    var targetCount = ~~(triangles.length * quality);
    var deletedTriangles = 0;

    var triangleCount = triangles.length;

    for (let i = 0; i < decimationIterations; i++) {
        if (triangleCount - deletedTriangles <= targetCount) break;


        for (var j = 0; j < triangles.length; ++j) {
            triangles[j].isDirty = false;
        }

        var threshold = 0.000000001 * Math.pow((i + 3), aggressiveness);

        for (let index = 0; index < Math.ceil(triangles.length / 2000); index++) {

            for (let j = 0; j < 5000; j++) {

                var iteration = index * 2000 + j;
                if (iteration >= triangles.length) break;
                if (triangleCount - deletedTriangles <= targetCount) break;

                var tIdx = ~~(((triangles.length / 2) + iteration) % triangles.length);
                var t = triangles[tIdx];
                if (!t) continue;

                if (t.error[3] > threshold || t.deleted || t.isDirty) continue;

                for (var k = 0; k < 3; ++k) {
                    if (t.error[k] < threshold) {
                        var deleted0 = [];
                        var deleted1 = [];

                        var v0 = t.vertices[k];
                        var v1 = t.vertices[(k + 1) % 3];
                        var v2 = t.vertices[(k + 2) % 3];

                        if (v0.isBorder || v1.isBorder) continue;

                        var p = new THREE.Vector3(0, 0, 0);
                        // var color = new Color4(0, 0, 0, 1);

                        calculateError(v0, v1, p);

                        var delTr = [];

                        if (isFlipped(triangles, references, v0, v1, v2, p, deleted0, delTr)) continue;
                        if (isFlipped(triangles, references, v1, v0, v2, p, deleted1, delTr)) continue;

                        if (deleted0.indexOf(true) < 0 || deleted1.indexOf(true) < 0) continue;

                        var uniqueArray = [];
                        delTr.forEach((deletedT) => {
                            if (uniqueArray.indexOf(deletedT) === -1) {
                                deletedT.deletePending = true;
                                uniqueArray.push(deletedT);
                            }
                        });

                        // if (uniqueArray.length % 2 !== 0) continue;

                        v0.q = v1.q.add(v0.q);

                        v0.updatePosition(p);

                        var tStart = references.length;

                        deletedTriangles = updateTriangles(triangles, references, v0, v0, deleted0, deletedTriangles);
                        deletedTriangles = updateTriangles(triangles, references, v0, v1, deleted1, deletedTriangles);

                        var tCount = references.length - tStart;

                        if (tCount <= v0.triangleCount) {
                            if (tCount) {
                                for (var c = 0; c < tCount; c++) {
                                    references[v0.triangleStart + c] = references[tStart + c];
                                }
                            }
                        } else {
                            v0.triangleStart = tStart;
                        }

                        v0.triangleCount = tCount;
                        break;
                    }
                }
            }
        }
        if (i % 5 === 0) {
            updateMesh(geometryResource, i % 20 === 0);
        }
    }
    updateMesh(geometryResource, false);

    return geometryResource;
}

function initGeometry(geometryBuffer) {
    function readFloat(buffer) {
        var floats = [];

        for (let i = 0; i < buffer.length / 4; i++) {
            floats[i] = buffer.readFloatLE(4 * i);
        }
        return floats;
    }

    function readIndices(buffer) {
        var indices = [];

        if (indexIsUInt16) {
            for (let i = 0; i < buffer.length / 2; i++) {
                indices[i] = buffer.readUInt16LE(2 * i);
            }
        } else {
            for (let i = 0; i < buffer.length / 4; i++) {
                indices[i] = buffer.readUInt32LE(4 * i);
            }
        }
        return indices;
    }

    function getVertex(index) {
        // if (vertex[index] && vertex[index].id === 501) console.log(vertex[index]);
        if (vertices[index]) return vertices[index];
        let offset = 3 * index;
        let uvOffset = 2 * index;
        let vector3 = new Vector3(position[offset], position[offset + 1], position[offset + 2]);
        let decimationVertex = new DecimationVertex(vector3, index);
        decimationVertex.normal = [normal[offset], normal[offset + 1], normal[offset + 2]];
        decimationVertex.uv = [uv[uvOffset], uv[uvOffset + 1]];

        for (let i = 0; i < vertices.length; i++) {
            const v = vertices[i];
            if (!v) continue;
            if (v.position.x === decimationVertex.position.x
                && v.position.y === decimationVertex.position.y
                && v.position.z === decimationVertex.position.z) {
                return v;
            }
        }

        var vertexKey = decimationVertex.position.x + ":" + decimationVertex.position.y + ":" + decimationVertex.position.z;
        let vertexIndex = vertexIndexMap.get(vertexKey);

        if (vertexIndex) {
            return vertices[vertexIndex]
        }
        vertexIndexMap.set(vertexKey, index);

        vertices[index] = decimationVertex;

        // FS.appendFile("temp.log", decimationVertex.position.toString() + "\r\n", () => {
        // });

        return decimationVertex;
    }

    var positionBuffer = geometryBuffer.position;
    var indicesBuffer = geometryBuffer.index;
    var indexIsUInt16 = geometryBuffer.indexIsUInt16;
    var normalBuffer = geometryBuffer.normal;
    var uvBuffer = geometryBuffer.uv;

    let position = readFloat(positionBuffer);
    let normal = readFloat(normalBuffer);
    let uv = readFloat(uvBuffer);
    let indices = readIndices(indicesBuffer);
    let vertices = [];
    let vertexIndexMap = new Map();
    var triangles = [];

    // position.forEach(p => {
    //     FS.appendFileSync("temp.log", p + "\r\n", () => {
    //     });
    // })

    // FS.appendFileSync("temp.log",indices.length+"\r\n");
    // FS.appendFileSync("temp.log",indices+"\r\n");
    // FS.appendFileSync("temp.log",position.length+"\r\n");
    // FS.appendFileSync("temp.log",position+"\r\n");

    for (let i = 0; i < indices.length / 3; i++) {
        let offset = 3 * i;
        let triangle = triangles[i] = new DecimationTriangle([getVertex(indices[offset]), getVertex(indices[offset + 1]), getVertex(indices[offset + 2])]);
        triangle.isDirty = false;
        triangle.normal = new Vector3().crossVectors(new Vector3().subVectors(triangle.vertices[1].position, triangle.vertices[0].position),
            new Vector3().subVectors(triangle.vertices[2].position, triangle.vertices[0].position)).normalize();
        for (var j = 0; j < 3; j++) {
            triangle.vertices[j].q.addArrayInPlace(dataFromNumbers(triangle.normal.x, triangle.normal.y, triangle.normal.z,
                -(triangle.normal.dot(triangle.vertices[0].position))));

            triangle.error[j] = calculateError(triangle.vertices[j], triangle.vertices[(j + 1) % 3]);
        }
        triangle.error[3] = Math.min(triangle.error[0], triangle.error[1], triangle.error[2]);
    }
    vertices = vertices.flat();

    position = uv = normal = indices = null;

    // triangles.forEach(triangle=>{
    //     FS.appendFileSync("temp.log", triangle.vertices[0].id + "," + triangle.vertices[1].id + "," + triangle.vertices[2].position.toString() + "\r\n", () => {});
    // })

    return new GeometryResource(triangles, vertices, []);
}

function reconstructBuffer(triangles, indexIsUInt16) {

    var vertexIndex = new Map();
    var index = [];
    var positions = [];
    var normals = [];
    var uvs = [];
    var vertexCount = 0;
    console.log("triangles number after simply " + triangles.length);
    triangles.forEach((triangle) => {
        // FS.appendFileSync("temp.log", triangle.vertices[0].id + "," + triangle.vertices[1].id + "," + triangle.vertices[2].position.toString() + "\r\n", () => {});
        triangle.vertices.forEach((vertex) => {
            let id = vertex.id;
            let position = vertex.position;
            let newIndex = vertexIndex.get(id);
            if (!newIndex) {
                vertexIndex.set(id, vertexCount);
                positions.push(position.x);
                positions.push(position.y);
                positions.push(position.z);
                vertex.normal && vertex.normal.forEach(n => {
                    normals.push(n)
                });
                vertex.uvs && vertex.uvs.forEach(n => {
                    uvs.push(n)
                });
                index.push(vertexCount);
                vertexCount++;
            } else {
                index.push(newIndex)
            }
        })
    });

    let positionBuffer = new Buffer.from(new Float32Array(positions).buffer);
    let normalsBuffer = new Buffer.from(new Float32Array(normals).buffer);
    let uvsBuffer = new Buffer.from(new Float32Array(uvs).buffer);
    let indicesBuffer;
    if (indexIsUInt16) {
        indicesBuffer = new Buffer.from(new Uint16Array(index).buffer);
    } else {
        indicesBuffer = new Buffer.from(new Uint32Array(index).buffer);
    }
    // console.log(index.length);
    // console.log(indicesBuffer.length);
    return new GeometryBuffer(positionBuffer, normalsBuffer, uvsBuffer, indicesBuffer, indexIsUInt16);
}

function updateTriangles(triangles, references, origVertex, vertex, deletedArray, deletedTriangles) {
    var newDeleted = deletedTriangles;
    for (var i = 0; i < vertex.triangleCount; ++i) {
        var ref = references[vertex.triangleStart + i];
        var t = triangles[ref.triangleId];
        if (t.deleted) continue;
        if (deletedArray[i] && t.deletePending) {
            t.deleted = true;
            newDeleted++;
            continue;
        }
        t.vertices[ref.vertexId] = origVertex;
        t.isDirty = true;
        t.error[0] = calculateError(t.vertices[0], t.vertices[1]) + (t.borderFactor / 2);
        t.error[1] = calculateError(t.vertices[1], t.vertices[2]) + (t.borderFactor / 2);
        t.error[2] = calculateError(t.vertices[2], t.vertices[0]) + (t.borderFactor / 2);
        t.error[3] = Math.min(t.error[0], t.error[1], t.error[2]);
        references.push(ref);
    }
    return newDeleted;
}

function updateMesh(geometryResource, identifyBorders) {

    var triangles = geometryResource.triangles;
    var vertices = geometryResource.vertices;
    var references = geometryResource.references;

    var i;
    if (!identifyBorders) {
        var tempTriangles = [].concat(triangles);
        triangles.length = 0;
        for (i = 0; i < tempTriangles.length; ++i) {
            if (!tempTriangles[i].deleted) {
                triangles.push(tempTriangles[i]);
            }
        }
    }

    for (i = 0; i < vertices.length; ++i) {
        vertices[i].triangleCount = 0;
        vertices[i].triangleStart = 0;
    }
    var t, j, v;
    for (i = 0; i < triangles.length; ++i) {
        t = triangles[i];
        for (j = 0; j < 3; ++j) {
            v = t.vertices[j];
            v.triangleCount++;
        }
    }

    var tStart = 0;

    for (i = 0; i < vertices.length; ++i) {
        vertices[i].triangleStart = tStart;
        tStart += vertices[i].triangleCount;
        vertices[i].triangleCount = 0;
    }

    references.length = 0;
    for (i = 0; i < triangles.length; ++i) {
        t = triangles[i];
        for (j = 0; j < 3; ++j) {
            v = t.vertices[j];
            references[v.triangleStart + v.triangleCount] = new Reference(j, i);
            v.triangleCount++;
        }
    }

    if (identifyBorders) {
        identifyBorder(geometryResource);
    }
}

function identifyBorder(geometryResource) {
    var triangles = geometryResource.triangles;
    var vertices = geometryResource.vertices;
    var references = geometryResource.references;

    for (var i = 0; i < vertices.length; ++i) {
        var vCount = [];
        var vId = [];
        var v = vertices[i];
        var j;
        for (j = 0; j < v.triangleCount; ++j) {
            var triangle = triangles[references[v.triangleStart + j].triangleId];
            for (var ii = 0; ii < 3; ii++) {
                var ofs = 0;
                var vv = triangle.vertices[ii];
                while (ofs < vCount.length) {
                    if (vId[ofs] === vv) break;
                    ++ofs;
                }
                if (ofs === vCount.length) {
                    vCount.push(1);
                    // vId.push(vv.id);
                    vId.push(vv);
                } else {
                    vCount[ofs]++;
                }
            }
        }

        for (j = 0; j < vCount.length; ++j) {
            // if (!vertices[vId[j]]) continue;
            if (vCount[j] === 1) {
                // vertices[vId[j]].isBorder = true;
                vId[j].isBorder = true;
            } else {
                // vertices[vId[j]].isBorder = false;
                vId[j].isBorder = false;
            }
        }

    }
}

function isFlipped(triangles, references, vertex1, vertex2, vertex3, point, deletedArray, delTr) {


    for (var i = 0; i < vertex1.triangleCount; ++i) {
        var index = references[vertex1.triangleStart + i].triangleId;
        var t = triangles[index];
        if (t.deleted) continue;

        var s = references[vertex1.triangleStart + i].vertexId;

        var v1 = t.vertices[(s + 1) % 3];
        var v2 = t.vertices[(s + 2) % 3];
        if ((v1 === vertex2 || v2 === vertex2)) {
            if (vertex1.triangleCount >= 3) {
                deletedArray[i] = true;
                delTr.push(t);
                continue;
            }
        }


        var d1 = new Vector3().subVectors(v1.position, point);
        d1 = d1.normalize();
        var d2 = new Vector3().subVectors(v2.position, point);
        d2 = d2.normalize();
        if (Math.abs(d1.dot(d2)) > 0.999) return true;
        var normal = new Vector3().crossVectors(d1, d2).normalize();
        deletedArray[i] = false;
        if (normal.dot(t.normal) < 0.2) return true;
    }

    return false;
}

function calculateError(vertex1, vertex2, pointResult) {
    var q = vertex1.q.add(vertex2.q);
    var border = vertex1.isBorder && vertex2.isBorder;
    var error = 0;
    var qDet = q.det(0, 1, 2, 1, 4, 5, 2, 5, 7);

    if (qDet !== 0 && !border) {
        if (!pointResult) {
            pointResult = new Vector3(0, 0, 0);
        }
        pointResult.x = -1 / qDet * (q.det(1, 2, 3, 4, 5, 6, 5, 7, 8));
        pointResult.y = 1 / qDet * (q.det(0, 2, 3, 1, 5, 6, 2, 7, 8));
        pointResult.z = -1 / qDet * (q.det(0, 1, 3, 1, 4, 6, 2, 5, 8));
        error = vertexError(q, pointResult);
    } else {
        // var p3 = (new THREE.Vector3().addVectors(vertex1.position, vertex2.position)).divide(new Vector3(2, 2, 2));
        var p3 = new THREE.Vector3().multiplyVectors(new THREE.Vector3().addVectors(vertex1.position, vertex2.position), new Vector3(1 / 2, 1 / 2, 1 / 2));
        var error1 = vertexError(q, vertex1.position);
        var error2 = vertexError(q, vertex2.position);
        var error3 = vertexError(q, p3);
        error = Math.min(error1, error2, error3);
        if (error === error1) {
            if (pointResult) {
                pointResult.copy(vertex1.position);
            }
        } else if (error === error2) {
            if (pointResult) {
                pointResult.copy(vertex2.position);
            }
        } else {
            if (pointResult) {
                pointResult.copy(p3);
            }
        }
    }
    return error;
}

function vertexError(q, point) {
    var x = point.x;
    var y = point.y;
    var z = point.z;
    return q.data[0] * x * x + 2 * q.data[1] * x * y + 2 * q.data[2] * x * z + 2 * q.data[3] * x + q.data[4] * y * y
        + 2 * q.data[5] * y * z + 2 * q.data[6] * y + q.data[7] * z * z + 2 * q.data[8] * z + q.data[9];
}

/**
 * @param position : ArrayBuffer
 * @param normal : ArrayBuffer
 * @param uv : ArrayBuffer
 * @param index : ArrayBuffer
 * @param indexIsUInt16 : boolean
 * @constructor
 */
function GeometryBuffer(position, normal, uv, index, indexIsUInt16) {
    this.position = position;
    this.normal = normal;
    this.uv = uv;
    this.index = index;
    this.indexIsUInt16 = indexIsUInt16;
}

function GeometryResource(triangles, vertices, references) {
    this.triangles = triangles;
    this.vertices = vertices;
    this.references = references;
}

function Reference(vertexId, triangleId) {
    this.vertexId = vertexId;
    this.triangleId = triangleId;
}

function DecimationTriangle(vertices) {
    this.normal = new Vector3();
    this.vertices = vertices;
    this.error = new Array(4);
    this.deleted = false;
    this.isDirty = false;
    this.borderFactor = 0;
    this.deletePending = false;
}

function DecimationVertex(position, id) {
    this.q = new QuadraticMatrix();
    this.isBorder = true;
    this.triangleStart = 0;
    this.triangleCount = 0;
    this.position = position;
    this.id = id;
}

DecimationVertex.prototype = {
    updatePosition: function (newPosition) {
        this.position.copy(newPosition);
    }
};

function QuadraticMatrix(data) {
    this.data = new Array(10);
    for (var i = 0; i < 10; ++i) {
        if (data && data[i]) {
            this.data[i] = data[i];
        } else {
            this.data[i] = 0;
        }
    }
}

QuadraticMatrix.prototype = {
    FromData: function (a, b, c, d) {
        return new QuadraticMatrix(dataFromNumbers(a, b, c, d));
    },

    det: function (a11, a12, a13, a21, a22, a23, a31, a32, a33) {
        var det = this.data[a11] * this.data[a22] * this.data[a33] + this.data[a13] * this.data[a21] * this.data[a32] +
            this.data[a12] * this.data[a23] * this.data[a31] - this.data[a13] * this.data[a22] * this.data[a31] -
            this.data[a11] * this.data[a23] * this.data[a32] - this.data[a12] * this.data[a21] * this.data[a33];
        return det;
    },

    addInPlace: function (matrix) {
        for (var i = 0; i < 10; ++i) {
            this.data[i] += matrix.data[i];
        }
    },

    addArrayInPlace: function (data) {
        for (var i = 0; i < 10; ++i) {
            this.data[i] += data[i];
        }
    },

    add: function (matrix) {
        var m = new QuadraticMatrix();
        for (var i = 0; i < 10; ++i) {
            m.data[i] = this.data[i] + matrix.data[i];
        }
        return m;
    }
};

function dataFromNumbers(a, b, c, d) {
    return [a * a, a * b, a * c, a * d, b * b, b * c, b * d, c * c, c * d, d * d];
}

module.exports = {
    runDecimation,
    GeometryBuffer,
    GeometryResource,
    initGeometry,
    reconstructBuffer
};