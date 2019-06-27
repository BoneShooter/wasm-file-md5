importScripts('./spark-md5.js');
importScripts('./main.js');

Module.onRuntimeInitialized = function () {
    console.log('wasm Module ready');
    postMessage({
        type: 'init',
        ready: true
    });
}

onmessage = function ($event) {
    const eventData = $event.data;
    let result = {};
    if (eventData.type === 'buffer') {
        const buffer = eventData.buffer;
        result = getMd5ByBuffer(buffer);
        postMessage(Object.assign({
            type: 'result',
        }, result));
    } else if (eventData.type === 'string') {
        const str = eventData.str;
        result = getMd5ByStr(str);
        postMessage(Object.assign({
            type: 'result',
        }, result));
    } else if (eventData.type === 'file') {
        const file = eventData.file;
        console.log(file);
        const fileSize = file.size;
        const step = 1024 * 1024;
        const blockCount = Math.floor(fileSize / step);
        const leftBlock = fileSize % step;
        const blockList = []
        let i;
        for (i = 0; i < blockCount; i++) {
            blockList.push({
                index: i,
                start: step * i,
                end: step * (i + 1)
            });
        }
        if (leftBlock > 0) {
            blockList.push({
                index: i,
                start: step * i,
                end: step * i + leftBlock
            });
        }
        let promiseList = [];
        for (let block of blockList) {
            const p = loadFiletoBlock(file, block);
            promiseList.push(p);
        }
        Promise.all(promiseList).then(() => {
            // 162f30dd7e186fa0aeb3ef5e9d9bc8ec
            console.time('calc spark md5');
            const spark = new SparkMD5.ArrayBuffer();
            for (let block of blockList) {
                spark.append(block.buffer);
            }
            const resultSpark = spark.end();
            console.log(resultSpark);
            console.timeEnd('calc spark md5');

            console.time('calc wasm md5');
            const resultWasm = []
            for (let block of blockList) {
                const u8a = new Uint8Array(block.buffer);
                const byteLength = u8a.byteLength;
                const ptr = Module._malloc(byteLength);// 分配内存，返回内存的起始指针位置
                const heapBytes = new Uint8Array(Module.HEAPU8.buffer, ptr, byteLength);
                heapBytes.set(u8a);
                resultWasm.push(Module.ccall(
                    'getBufferMD5',
                    'string',
                    ['number', 'number'],
                    [ptr, byteLength],
                ));
                Module._free(ptr);// 释放内存
            }
            console.log(resultWasm.length);
            console.timeEnd('calc wasm md5');
            // for (let block of blockList) {
            //     block.md5Result = getMd5ByBuffer(block.buffer);
            // }
            // let timeJS = 0;
            // let timeWasm = 0;
            // for (let block of blockList) {
            //     timeJS = timeJS + block.md5Result.spark.time;
            //     timeWasm = timeWasm + block.md5Result.wasm.time;
            // }
            // this.console.log(timeJS);
            // this.console.log(timeWasm);
            // console.log(blockList);
            postMessage(Object.assign({
                type: 'result'
            }, result));
        });
    }
}

function loadFiletoBlock(file, block) {
    return new Promise((resolve, reject) => {
        const b = file.slice(block.start, block.end);
        const fr = new FileReader();
        fr.onerror = function () {
            reject();
        }
        fr.onload = function () {
            const ab = fr.result;
            block.byteLength = ab.byteLength;
            block.buffer = ab;
            resolve();
        }
        fr.readAsArrayBuffer(b);
    });
}

function getMd5ByBuffer(buffer) {
    const u8a = new Uint8Array(buffer);
    const byteLength = u8a.byteLength;// 数据长度
    // SparkMD5
    let jsSpendTime;
    const jsStartTime = Date.now();
    const spark = new SparkMD5.ArrayBuffer();
    spark.append(u8a);
    const resultSpark = spark.end();
    const jsEndTime = Date.now();
    jsSpendTime = jsEndTime - jsStartTime;
    // wasm
    let wasmSpendTime;
    const wasmStartTime = Date.now();
    const ptr = Module._malloc(byteLength);// 分配内存，返回内存的起始指针位置
    // console.log(ptr);
    const heapBytes = new Uint8Array(Module.HEAPU8.buffer, ptr, byteLength);
    heapBytes.set(u8a);
    /**
     * function name
     * return type
     * params type
     * params
     */
    const resultWasm = Module.ccall(
        'getBufferMD5',
        'string',
        ['number', 'number'],
        [ptr, byteLength],
    );
    Module._free(ptr);// 释放内存
    const wasmEndTime = Date.now();
    wasmSpendTime = wasmEndTime - wasmStartTime;
    return {
        spark: {
            result: resultSpark,
            time: jsSpendTime
        },
        wasm: {
            result: resultWasm,
            time: wasmSpendTime
        }
    };
}

function getMd5ByStr(str) {
    // SparkMD5
    let jsSpendTime;
    const jsStartTime = Date.now();
    const spark = new SparkMD5();
    spark.append(str);
    const resultSpark = spark.end();
    const jsEndTime = Date.now();
    jsSpendTime = jsEndTime - jsStartTime;
    // wasm
    let wasmSpendTime;
    const wasmStartTime = Date.now();
    /**
     * function name
     * return type
     * params type
     * params
     */
    const resultWasm = Module.ccall(
        'getStringMD5',
        'string',
        ['string'],
        [str],
    );
    const wasmEndTime = Date.now();
    wasmSpendTime = wasmEndTime - wasmStartTime;
    return {
        spark: {
            result: resultSpark,
            time: jsSpendTime
        },
        wasm: {
            result: resultWasm,
            time: wasmSpendTime
        }
    };
}