<?php

return [
    'groq' => [
        'api_key_chat' => env('GROQ_API_KEY_CHAT'),
    ],
    'fish' => [
        'api_key' => env('FISH_API_KEY'),
        'model' => env('FISH_MODEL', 's2.1-pro-free'),
        'ffmpeg' => env('FISH_FFMPEG', ''),
        'voices' => [
            [
                'id' => 'ba9fccd271b24b6aaf7eb58e1f1c858a',
                'name' => 'Miku Nakano',
                'likes' => 16,
                'gain_db' => 0,
            ],
            [
                'id' => '72c3988b410f43c9b0905521135ff010',
                'name' => 'Marin',
                'likes' => 8,
                'gain_db' => 0,
            ],
            [
                'id' => '0c03219a981c4570a1b23a15b4107f30',
                'name' => 'Makima',
                'likes' => 79,
                'gain_db' => 16,
            ],
            [
                'id' => '7e9fe06681074145b0227d3685b3b570',
                'name' => 'Reze',
                'likes' => 41,
                'gain_db' => 0,
            ],
            [
                'id' => '4371047e054b4bd28073cd643f5077ff',
                'name' => 'Horikita',
                'likes' => 3,
                'gain_db' => 0,
            ],
            [
                'id' => 'c85fb11f91f84312a4bd16756f298ae2',
                'name' => 'Gojo',
                'likes' => 601,
                'gain_db' => 0,
            ],
            [
                'id' => 'b1d5b2071ce3450b8f497cca90b78061',
                'name' => 'Toji',
                'likes' => 132,
                'gain_db' => 0,
            ],
        ],
    ],
];
