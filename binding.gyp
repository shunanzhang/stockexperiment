{
  "targets": [
    {
      "target_name": "addon",
      "sources": [
        "src/addon.cc",
        "src/sma.cc",
        "src/tradeController.cc",
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
