#!/usr/bin/env node
let program = require("commander");
let pkg = require("../../package");
let GLTFHandler = require("../handler/gltf/gltfHandler");
let OBJHandler = require("../handler/obj/objHandler");
let FS = require("fs");

// shared parameter
program
    .option("-f, --file [value]", "the file to simplify", "")
    .option("-o, --outputPath [value]", "the path to write output file", "")
    .option("-m, --method [value]", "the method used to simply the geometry support [VertexClustering, QuadricError], default is 'QuadricError'", "")
    .option("-q, --quality <n>", "the quality of the simplified gltf,it should between 0 and 1", parseFloat)
    .option("-s, --segments <n>", "Used in 'VertexClustering', define the segments to split (needs to be > 1), the lower the segments is, the lower the resulting geometry faces", parseFloat)
    .option("-n, --normalJoinAngle <n>", "Used in 'VertexClustering', define the angle of normal join, if not provided, will be 60 degrees by default", parseFloat);

program.parse(process.argv);
if (!program.outputPath || !program.file || (!program.quality && !program.method)) {
    program.help();
}

program
    .command("gltf")
    .version(pkg.version)
    .description("simplify gltf")
    .action((command) => {
        gltfSimplify();
        console.log("simplify finish")
    });

program
    .command("obj")
    .version(pkg.version)
    .description("simplify obj")
    .action((command) => {
        objSimplify();
        console.log("simplify finish")
    });
// new program add like follow code
// program
//     .command("name")
//     .version(pkg.version)
//     .description("command example")
//     .action((command) => {
//         console.log(a)
//     });

// command code should write before here
program.parse(process.argv);

function gltfSimplify() {
    let outputPath = program.outputPath;
    let file = program.file;
    let quality = program.quality;

    let gltfJson = FS.readFileSync(file, 'utf8');
    let gltfResult;
    // if (program.method === 'VertexClustering') {
    //     gltfResult = GLTFHandler.Gsimplify(gltfJson, program.segments, undefined, program.normalJoinAngle);
    // } else {
    gltfResult = GLTFHandler.simplify(JSON.parse(gltfJson), quality);
    // }
    FS.writeFile(outputPath, JSON.stringify(gltfResult), (error) => {
        if (error)
            console.log(error)
    })
}

function objSimplify() {
    let outputPath = program.outputPath;
    let file = program.file;
    let quality = program.quality;

    let obj = FS.readFileSync(file, 'utf8');
    let objResult;
    if (program.method === 'VertexClustering') {
        objResult = OBJHandler.Gsimplify(obj, program.segments, undefined, program.normalJoinAngle);
    } else {
        objResult = OBJHandler.simplify(obj, quality);
    }


    FS.writeFile(outputPath, objResult, (error) => {
        if (error)
            console.log(error)
    })
}