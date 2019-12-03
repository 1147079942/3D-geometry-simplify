#!/usr/bin/env node
let program = require("commander");
let pkg = require("../../package");
let GLTFHandler = require("../handler/gltfHandler");
let FS = require("fs");

// shared parameter
program
    .option("-f, --file [value]", "the file to simplify", "")
    .option("-o, --outputPath [value]", "the path to write output file", "")
    .option("-q, --quality <n>", "the quality of the simplified gltf,it should between 0 and 1", parseFloat);

program.parse(process.argv);
if (!program.outputPath || !program.file || !program.quality) {
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

    let gltfJson = JSON.parse(FS.readFileSync(file, 'utf8'));

    let gltfResult = GLTFHandler.simplify(gltfJson, quality);

    FS.writeFile(outputPath, JSON.stringify(gltfResult), (error) => {
        if (error)
            console.log(error)
    })
}