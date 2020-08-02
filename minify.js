//
// Minify script
// > npm install -D uglify-js
// > node minify.js
//
let JS = [
    "jquery.iocurve.js"
];

let UglifyJS = require('uglify-js');
let fs = require('fs');
let path = require('path');

let SRCDIR = __dirname + '/src';
let DSTDIR = __dirname + '/dist';

for( let i=0; i<JS.length; i++ ) JSminify(JS[i]);

function JSminify( file ){
    let src = SRCDIR + '/' + file;
    let dst = DSTDIR + '/' + file.replace(/\.js$/, '.min.js');
    src = path.resolve(src);
    dst = path.resolve(dst);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    console.log(src);
    let code = fs.readFileSync(src, 'utf8');
    let result = UglifyJS.minify(code);
    if( result.error ) console.log(result.error);
    else fs.writeFileSync(dst, result.code, 'utf8');
    console.log(dst);
}
