/* 验证本地化 jszip.min.js 可正常生成 ZIP */
const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('jszip.min.js', 'utf8');
const sandbox = {
    window: {},
    self: {},
    console,
    setTimeout,
    clearTimeout,
    setImmediate,
    clearImmediate,
    navigator: { platform: 'node' }
};
sandbox.self = sandbox;
sandbox.window = sandbox;
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const JSZip = sandbox.window.JSZip || sandbox.JSZip;
if (!JSZip) {
    console.log('FAIL: window.JSZip 不存在');
    process.exit(1);
}
console.log('JSZip 加载成功，存在版本:', (JSZip.version || 'unknown'));

const zip = new JSZip();
zip.file('test.txt', 'hello watermark');
zip.file('photo.png', 'fake-blob');
zip.generateAsync({ type: 'blob' }).then((blob) => {
    console.log('ZIP 生成成功，大小:', blob.size, '字节');
    console.log('JSZip 库验证通过');
}).catch((e) => {
    console.log('ZIP 生成失败:', e.message);
    process.exit(1);
});