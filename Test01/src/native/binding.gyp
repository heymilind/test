{
  "targets": [
    {
      "target_name": "llm_inference",
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "sources": [ "llm_inference.cpp" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "../../external/llama.cpp/include",
        "../../external/llama.cpp/ggml/include"
      ],
      "libraries": [
        "../../../build/lib/libllama.dylib",
        "../../../build/lib/libggml.dylib",
        "../../../build/lib/libggml-metal.dylib",
        "../../../build/lib/libggml-base.dylib",
        "../../../build/lib/libggml-cpu.dylib"
      ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
      "conditions": [
        ['OS=="mac"', {
          "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "CLANG_CXX_LIBRARY": "libc++",
            "MACOSX_DEPLOYMENT_TARGET": "10.15",
            "OTHER_LDFLAGS": [
              "-Wl,-rpath,@loader_path",
              "-Wl,-rpath,@loader_path/lib"
            ]
          }
        }],
        ['OS=="win"', {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1
            }
          }
        }]
      ]
    }
  ]
}