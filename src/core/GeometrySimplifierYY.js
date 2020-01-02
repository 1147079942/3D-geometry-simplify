const THREE = require("three");

var GeometrySimplifier = function () {

    // publics
    this.source = null;
    this.box = new THREE.Box3();
    this.gridSize = null;
    this.segments = null;

    // privates

    /**
     * Array<[faces]>: index -> vertexIndex
     */
    let vertFaceArray = [];

    /**
     * Map<gridid, gridinfo>
     * eg. gridid: "0_2_1", gridinfo: { vertices: [], point: [], uvs: [], newUVs: [] }
     */
    let gridsmap = new Map();
    let xcomp = 0;
    let ycomp = 0;
    let zcomp = 0;
    let xsegs = 0;
    let ysegs = 0;
    let zsegs = 0;
    
    let scope = this;
    let faces, vertices, uvsArr, hasUVs;
    let normalDiffThreshold = Math.cos(60 * Math.PI / 180);


    /**
     * parseGeometry
     *
     */
    function parseGeometry() {

        let source;
        if (scope.source instanceof THREE.Geometry) {

            source = scope.source;

        } else if (scope.source instanceof THREE.BufferGeometry) {

            source = new THREE.Geometry().fromBufferGeometry(scope.source);

        } else {

            console.error("The geometry to be simplified is neither 'THREE.Geometry' nor 'THREE.BufferGeometry' ");

        }

        faces = source.faces.map(face => face.clone());
        vertices = source.vertices.map(vert => vert.clone());
        uvsArr = source.faceVertexUvs;

        if (uvsArr.length > 0 && uvsArr[0].length > 0) {
            hasUVs = true;
        } else {
            hasUVs = false;
        }

        vertFaceArray = new Array(vertices.length);
        for (let i = 0, fl = faces.length; i < fl; i++) {

            let face = faces[i];
            face.degenerated = false;
            face.grids = { a: null, b: null, c: null };

            var vertFaceRelation = vertFaceArray[face.a];
            if (!vertFaceRelation) {
                vertFaceArray[face.a] = [{
                    f: face,   // the related face
                    i: "a"     // the face index
                }];
            } else {
                vertFaceRelation.push({ f: face, i: "a" });
            }

            vertFaceRelation = vertFaceArray[face.b];
            if (!vertFaceRelation) {
                vertFaceArray[face.b] = [{
                    f: face,   // the related face
                    i: "b"     // the face index
                }];
            } else {
                vertFaceRelation.push({ f: face, i: "b" });
            }

            vertFaceRelation = vertFaceArray[face.c];
            if (!vertFaceRelation) {
                vertFaceArray[face.c] = [{
                    f: face,   // the related face
                    i: "c"     // the face index
                }];
            } else {
                vertFaceRelation.push({ f: face, i: "c" });
            }
        }

    }


    /**
     * initGridsInfo
     *
     */
    function initGridsInfo() {
        gridsmap = new Map();
        scope.source.computeBoundingBox();

        let size = new THREE.Vector3();
        let center = new THREE.Vector3();
        scope.source.boundingBox.getSize(size);
        scope.source.boundingBox.getCenter(center);

        scope.box = scope.source.boundingBox.clone();
        // scope.box = new THREE.Box3().setFromCenterAndSize(center, size);

        if (scope.gridSize) {
            // use gridSize first
            xcomp = scope.gridSize;
            ycomp = scope.gridSize;
            zcomp = scope.gridSize;

            xsegs = size.x / scope.gridSize;
            ysegs = size.y / scope.gridSize;
            zsegs = size.z / scope.gridSize;

        } else if (scope.segments) {
            // use segments
            xcomp = size.x / scope.segments;
            ycomp = size.y / scope.segments;
            zcomp = size.z / scope.segments;

            xsegs = scope.segments;
            ysegs = scope.segments;
            zsegs = scope.segments;
        }

        scope.box = new THREE.Box3().setFromCenterAndSize(center, size);

    }


    /**
     * computeGridid
     *
     * @param {*} vertex
     * @returns
     */
    function computeGridid(vertex) {
        let x = Math.round((vertex.x - scope.box.min.x) / xcomp);
        let y = Math.round((vertex.y - scope.box.min.y) / ycomp);
        let z = Math.round((vertex.z - scope.box.min.z) / zcomp);

        // prevent the vertex to be fitted in out-of-box grid (gridid is based on lower bound index)
        // if (x >= xsegs) x = xsegs - 1;
        // if (y >= ysegs) y = ysegs - 1;
        // if (z >= zsegs) z = zsegs - 1;

        // if (x <= 0) x = - 1;
        // if (y <= 0) y = - 1;
        // if (z <= 0) z = - 1;

        return `${x}_${y}_${z}`;
    }


    /**
     * computeVertexGrid
     *
     * @param {*} vertex
     * @returns
     */
    function computeVertexGrid(vertex) {

        let gridid = computeGridid(vertex);

        vertex.gridid = gridid;
        let grid = gridsmap.get(gridid);
        if (!!grid) {
            grid.vertices.push(vertex);
        } else {
            grid = {
                vertices: [vertex],
                point: null,
                uvs: [],
                newUVs: []
            };
            gridsmap.set(gridid, grid);
        }
        return grid;
    }


    /**
     * addGridUV
     *
     * @param {*} grid
     * @param {*} faceIndex
     * @param {*} abc
     */
    function addGridUV(grid, faceIndex, abc) {
        for (let i = 0, uvl = uvsArr.length; i < uvl; i++) {
            let uvArr = uvsArr[i]; //[uvs]
            let faceUV = uvArr[faceIndex]; //[uv0, uv1, uv2]
            if (!grid.uvs[i]) grid.uvs[i] = [];
            if (abc == "a") grid.uvs[i].push(faceUV[0]);
            if (abc == "b") grid.uvs[i].push(faceUV[1]);
            if (abc == "c") grid.uvs[i].push(faceUV[2]);
        }
    }


    /**
     * computeGridAvgPoint
     *
     * @param {*} grid
     */
    function computeGridAvgPoint(grid) {
        let sumx = 0;
        let sumy = 0;
        let sumz = 0;
        let n = grid.vertices.length;
        for (let i = 0; i < n; i++) {
            sumx += grid.vertices[i].x;
            sumy += grid.vertices[i].y;
            sumz += grid.vertices[i].z;
        }
        grid.point = new THREE.Vector3(sumx / n, sumy / n, sumz / n);
    }

    /**
     * computeGridAvgUV
     *
     * @param {*} grid
     */
    function computeGridAvgUV(grid) {
        for (let i = 0, l = grid.uvs.length; i < l; i++) {
            let uvArr = grid.uvs[i];
            let sumx = 0;
            let sumy = 0;
            let n = uvArr.length;
            for (let j = 0; j < n; j++) {
                sumx += uvArr[j].x;
                sumy += uvArr[j].y;
            }
            grid.newUVs[i] = new THREE.Vector2(sumx / n, sumy / n);
        }
    }


    function computeGridMaxUV(grid) {
        for (let i = 0, l = grid.uvs.length; i < l; i++) {
            let uvArr = grid.uvs[i];
            let maxx = 0;
            let maxy = 0;
            let n = uvArr.length;
            for (let j = 0; j < n; j++) {
                maxx = Math.max(uvArr[j].x, maxx);
                maxy = Math.max(uvArr[j].y, maxy);
            }
            grid.newUVs[i] = new THREE.Vector2(maxx, maxy);
        }
    }


    /**
     * checkFaceDegen
     *
     * @param {*} face
     * @returns
     */
    function checkFaceDegen(face) {
        let a = vertices[face.a];
        let b = vertices[face.b];
        let c = vertices[face.c];
        if (a.gridid == b.gridid || a.gridid == c.gridid || b.gridid == c.gridid) {
            face.degenerated = true;
            return true;
        }
        return false;
    }

    /**
     * compareNormalDiffs
     *
     * @param {*} normDiffArray
     * @param {*} face
     * @returns
     */
    function compareNormalDiffs(normDiffArray, face) {
        for (let i = 0, l = normDiffArray.length; i < l; i++) {
            let dot = normDiffArray[i].n.dot(face.normal);
            if (dot > normalDiffThreshold) {
                normDiffArray[i].f.push(face);
                normDiffArray[i].n = normDiffArray[i].n.add(face.normal);
                normDiffArray[i].n.normalize();
                return;
            }
        }
        // not found any faces that has similar normal value, add to list as new one
        normDiffArray.push({
            f: [face],
            n: face.normal.clone()
        });
    }

    /**
     * resortVerticesOrder
     *
     * @param {*} newGeom
     */
    function resortVerticesOrder(newGeom) {
        // find first vertex without gridid (duplicated)
        let dupIndexStart = newGeom.vertices.findIndex(v => v.gridid == undefined);
        let vl = newGeom.vertices.length;

        for (let i = dupIndexStart; i < vl; i++) {

            let vert = newGeom.vertices[i];
            // let findOriginFaces = newGeom.faces.find(f => f.a == i || f.b == i || f.c == i);

            let computedGridid = computeGridid(vert);
            let findOriginIndex = newGeom.vertices.findIndex(v => v.gridid == computedGridid);
            let newVertIndex = findOriginIndex + 1;

            // set the vertex to new index
            newGeom.vertices.splice(newVertIndex, 0, vert.clone());

            // remove the original vertex
            newGeom.vertices.splice(i + 1, 1);

            // set face's index to new value
            for (let j = 0, fl = newGeom.faces.length; j < fl; j++) {
                let face = newGeom.faces[j];

                if (face.a == i) {
                    face.a = newVertIndex;
                } else if (face.a > findOriginIndex && face.a < i) {
                    face.a++;
                }

                if (face.b == i) {
                    face.b = newVertIndex;
                } else if (face.b > findOriginIndex && face.b < i) {
                    face.b++;
                }

                if (face.c == i) {
                    face.c = newVertIndex;
                } else if (face.c > findOriginIndex && face.c < i) {
                    face.c++;
                }
            }
        }

    }


    /**
     * simplify(geometry, params) : THREE.Geometry
     *
     * @param {THREE.Geometry / THREE.BufferGeometry} geometry
     * @param {Object} params { segments: int(2, ~), errorThreshold: float(0, ~), normalJoinAngle: float(0-180) }
     * 
     * @returns {THREE.Geometry}
     */
    this.simplify = function (geometry, params) {

        if (params.errorThreshold <= 0) {
            console.error("The errorThreshold must be greater than 0");
            return;
        }

        if (params.segments !== undefined) {
            // if no errorThreshold given, use parameter segments
            this.segments = Math.max(params.segments, 2);
        } else if (params.errorThreshold !== undefined) {
            // errorThreshold = gridSize * sqrt(3) / 2
            this.gridSize = Math.max(params.errorThreshold, 0.001) * 2 / 1.7320508075688772;
        }


        let normalJoinAngle = params.normalJoinAngle || 60;
        normalDiffThreshold = Math.cos(normalJoinAngle * Math.PI / 180);

        this.source = geometry;

        let newGeom = new THREE.Geometry();

        parseGeometry();

        initGridsInfo();

        // determine every vertex's box & check face's degeneration
        for (let i = 0, fl = faces.length; i < fl; i++) {
            let face = faces[i];

            // compute every vertex's box
            let grid;
            grid = computeVertexGrid(vertices[face.a]);
            if (hasUVs) addGridUV(grid, i, "a");

            grid = computeVertexGrid(vertices[face.b]);
            if (hasUVs) addGridUV(grid, i, "b");

            grid = computeVertexGrid(vertices[face.c]);
            if (hasUVs) addGridUV(grid, i, "c");

            checkFaceDegen(face);
        }

        console.log("faces.length", faces.length)
        // let validFaces = faces.filter(f => !f.degenerated);

        // set every vertex to be the grid-point-value
        gridsmap.forEach((grid) => {
            if (grid.vertices.length > 0) {
                if (!grid.point) {
                    computeGridAvgPoint(grid);
                }
                if (!grid.uv) {
                    computeGridAvgUV(grid);
                    // computeGridMaxUV(grid);
                }
                // set rest of the vertices to be the grid's point
                for (let i = 0; i < grid.vertices.length; i++) {
                    grid.vertices[i].set(grid.point.x, grid.point.y, grid.point.z);
                }
            }
        });


        // filter out the valid vertices & set valid faces new index
        for (let i = 0, al = vertFaceArray.length; i < al; i++) {

            let faceArr = vertFaceArray[i];

            let vert = vertices[i];
            let findVertex = newGeom.vertices.find(v => v.gridid == vert.gridid);

            // if the grid's vertex has been added already, it is not needed to add again
            if (!findVertex) {
                // vertex not found, needs to add to vertices
                let index = newGeom.vertices.push(vert) - 1;
                // set the new face indices
                for (let i = 0; i < faceArr.length; i++) {
                    let faceObj = faceArr[i];
                    faceObj.f[faceObj.i] = index;
                    faceObj.f.grids[faceObj.i] = vert.gridid;
                }
            } else {
                // found same grid's vertex, no need to add vertex, just use the same index
                let index = newGeom.vertices.indexOf(findVertex);
                // set the new face indices
                for (let i = 0; i < faceArr.length; i++) {
                    let faceObj = faceArr[i];
                    faceObj.f[faceObj.i] = index;
                    faceObj.f.grids[faceObj.i] = vert.gridid;
                }
            }

        }

        // add new faces (which are not degenerated)
        for (let i = 0, fl = faces.length; i < fl; i++) {
            let face = faces[i];
            if (!face.degenerated) {
                newGeom.faces.push(face);
                // set new uvs
                if (hasUVs) {
                    for (let j = 0, uvl = uvsArr.length; j < uvl; j++) {
                        let uv0 = gridsmap.get(face.grids.a).newUVs[j];
                        let uv1 = gridsmap.get(face.grids.b).newUVs[j];
                        let uv2 = gridsmap.get(face.grids.c).newUVs[j];
                        newGeom.faceVertexUvs[j].push([uv0, uv1, uv2]);
                    }
                }
            }
        }

        newGeom.computeFaceNormals();

        // to generate smooth normal on mesh, compare each vertex's face's normals
        // if one vertex has too much difference on face normals, duplicate it in vertices array
        for (let i = 0, vl = newGeom.vertices.length; i < vl; i++) {
            let vertex = newGeom.vertices[i];
            let filteredFaces = newGeom.faces.filter(f => f.a == i || f.b == i || f.c == i);
            let fl = filteredFaces.length;
            if (fl > 1) {
                let normDiffs = [{
                    f: [filteredFaces[0]],
                    n: filteredFaces[0].normal.clone()
                }];
                for (let j = 1; j < fl; j++) {
                    let anotherFace = filteredFaces[j];
                    compareNormalDiffs(normDiffs, anotherFace);
                }
                if (normDiffs.length > 1) {
                    for (let j = 1, l = normDiffs.length; j < l; j++) {
                        let ff = normDiffs[j].f;
                        // duplicate the vertex in array (insert after this vertex)
                        let newIndex = newGeom.vertices.push(vertex.clone()) - 1;
                        for (let k = 0, ffl = ff.length; k < ffl; k++) {
                            if (ff[k].a == i) ff[k].a = newIndex;
                            if (ff[k].b == i) ff[k].b = newIndex;
                            if (ff[k].c == i) ff[k].c = newIndex;
                        }

                    }
                }
            }

        }

        // re-sort the new vertices, to be gpu friendly order. RESULT NOT AS EXPECTED. 
        // resortVerticesOrder(newGeom);

        newGeom.computeBoundingBox();
        newGeom.computeVertexNormals();

        return newGeom;
    }

}

module.exports = {
    GeometrySimplifier
}

