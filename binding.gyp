{
  "targets": [
    {
      "target_name": "addon",
      "sources": [
        "src/addon.cc",
        "src/sma.cc",
        "src/tradeController.cc",
        "src/IbClient.cc",
        "IBJts/source/PosixClient/src/EPosixClientSocket.cpp",
        "IBJts/source/PosixClient/src/EClientSocketBase.cpp",
      ],
      "defines": [
        "IB_USE_STD_STRING"
      ],
      "include_dirs": [
        "IBJts/source/PosixClient/Shared",
        "IBJts/source/PosixClient/src",
      ],
      "cflags":  ['-c -O3 -ffast-math -fexpensive-optimizations -DNDEBUG -march=native'],
      "cflags_cc": ['-c -O3 -ffast-math -fexpensive-optimizations -DNDEBUG -march=native'],
      'cflags!': [ '-fno-exceptions' ],
      'cflags_cc!': [ '-fno-exceptions' ],
      'conditions': [
        ['OS=="mac"', {
          'xcode_settings': {
            'GCC_ENABLE_CPP_EXCEPTIONS': 'YES'
          },
        }],
      ]
    }
  ]
}
