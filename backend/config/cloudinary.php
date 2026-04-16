<?php

return [
    'cloud_url' => env('CLOUDINARY_URL'),
    
    'upload_preset' => env('CLOUDINARY_UPLOAD_PRESET', 'ml_default'),

    'options' => [
        'cloud_name' => env('CLOUDINARY_CLOUD_NAME'),
        'api_key'    => env('CLOUDINARY_API_KEY'),
        'api_secret' => env('CLOUDINARY_API_SECRET'),
    ],
];