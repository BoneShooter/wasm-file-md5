if [ ! -d "./build" ]; then
  mkdir ./build
fi
cd src
#  -s "ALLOW_MEMORY_GROWTH=1" -s "TOTAL_STACK=15728640" -s "TOTAL_MEMORY=16777216"
emcc main.cpp  -s "ALLOW_MEMORY_GROWTH=1" -s "EXPORTED_FUNCTIONS=['_getBufferMD5','_getStringMD5']" -s "EXTRA_EXPORTED_RUNTIME_METHODS=['ccall']" -o ../build/main.js
cd ..
cp ./build/main.js ./js/main.js
cp ./build/main.wasm ./js/main.wasm
rm build -rf