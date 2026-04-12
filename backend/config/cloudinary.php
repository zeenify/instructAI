<?php

return [
    'cloud_url' => env('CLOUDINARY_URL'),
    
    'upload_preset' => env('CLOUDINARY_UPLOAD_PRESET', 'ml_default'),

    'notification_url' => env('CLOUDINARY_NOTIFICATION_URL'),

    'options' => [
        'cloud_name' => env('CLOUDINARY_CLOUD_NAME', 'dbcewwqil'),
        'api_key'    => env('CLOUDINARY_API_KEY', '943439599195593'),
        'api_secret' => env('CLOUDINARY_API_SECRET', 'Onj0z0LQGyUAMQvmWhNPy237x0E'),
    ],
];