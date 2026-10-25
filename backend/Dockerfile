# 1. Change this line from 8.3 to 8.4
FROM php:8.4-cli

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    libzip-dev \
    zip \
    unzip \
    libpq-dev

# Clear cache
RUN apt-get clean && rm -rf /var/lib/apt/lists/*

# Install PHP extensions
RUN docker-php-ext-install pdo pdo_pgsql mbstring exif pcntl bcmath gd zip

# Get latest Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Set working directory
WORKDIR /var/www

# Copy existing application directory
COPY . /var/www

# Install Laravel dependencies
RUN composer install --no-dev --optimize-autoloader

# Run Laravel optimizations
RUN php artisan config:cache && php artisan route:cache

# Set permissions
RUN chown -R www-data:www-data /var/www/storage /var/www/bootstrap/cache

EXPOSE 10000

# artisan serve wraps PHP's built-in server, which handles ONE request at a
# time by default — a single long SSE/upload/export request wedged the whole
# site (Render's edge 503'd everything else). Forked workers share memory
# copy-on-write, so 4 is safe on the free tier's 512MB.
# NOTE: Laravel ONLY honors this with --no-reload (its .env file-watcher
# otherwise forces a single server); production never edits .env live.
ENV PHP_CLI_SERVER_WORKERS=4

# Start the Laravel server and run migrations
# Replace the last line of your Dockerfile with this:
CMD php artisan config:clear && php artisan migrate --force && php artisan serve --host=0.0.0.0 --port=10000 --no-reload