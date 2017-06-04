{
  "targets": [
    {
      "target_name": "addon",
      "sources": [
        "src/addon.cc",
        "src/sma.cc",
        "src/tradeController.cc",
        "src/IbClient.cc",
      ],
      "defines": [
      ],
      "include_dirs": [
        "IBJts/source/CppClient/client",
      ],
      "cflags":  ['-c -O3 -ffast-math -fexpensive-optimizations -DNDEBUG -march=native -std=c++11'],
      "cflags_cc": ['-c -O3 -ffast-math -fexpensive-optimizations -DNDEBUG -march=native -std=c++11'],
      'cflags!': [ '-fno-exceptions' ],
      'cflags_cc!': [ '-fno-exceptions' ],
      'conditions': [
        ['OS=="mac"', {
          'xcode_settings': {
            'GCC_ENABLE_CPP_EXCEPTIONS': 'YES',
            'OTHER_CPLUSPLUSFLAGS': ['-std=c++11'],
          },
        }],
      ]
    }
  ]
}
