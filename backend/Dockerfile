# 1. Change this line from 8.3 to 8.4
FROM php:8.4-cli

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    zip \
    unzip \
    libpq-dev

# Clear cache
RUN apt-get clean && rm -rf /var/lib/apt/lists/*

# Install PHP extensions
RUN docker-php-ext-install pdo pdo_pgsql mbstring exif pcntl bcmath gd

# Get latest Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Set working directory
WORKDIR /var/www

# Copy existing application directory
COPY . /var/www

# Install Laravel dependencies
# Adding --ignore-platform-reqs as a safety net for Docker environments
RUN composer install --no-dev --optimize-autoloader

# Run Laravel optimizations
RUN php artisan config:cache && php artisan route:cache

# Set permissions
RUN chown -R www-data:www-data /var/www/storage /var/www/bootstrap/cache

EXPOSE 10000

# Start the Laravel server and run migrations
CMD php artisan migrate --force && php artisan serve --host=0.0.0.0 --port=10000