# Wawa Lipsync

A **simple** and **easy-to-use** library built in TypeScript for **real-time lipsyncing with JS and web audio API**. Ideal for animating 2D/3D characters in web apps, chatbots, and games.

The examples shows how to use the library with a 3D model in Three.js with React Three Fiber.

[Live demo](https://wawa-lipsync.wawasensei.dev/)

## Installation

```bash
npm install wawa-lipsync
```

or

```bash
yarn add wawa-lipsync
```

## Usage

First, import the library and create a `Lipsync` instance:

```javascript
import { Lipsync } from "wawa-lipsync";

export const lipsyncManager = new Lipsync();
```

Then, you need to connect the [HTML `<audio>` element](https://www.w3schools.com/html/html5_audio.asp) to the `lipsyncManager`:

```javascript
const audioElement = new Audio("path/to/your/audio/file.mp3");

lipsyncManager.connectAudio(audioElement);
```

The [AnalyserNode](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode) used by the library requires the audio element to have a valid source before the connection.

This will work:

```javascript
const audioElement = new Audio();
audioElement.src = "path/to/your/audio/file.mp3";
lipsyncManager.connectAudio(audioElement);
```

But this will not:

```javascript
const audioElement = new Audio();
lipsyncManager.connectAudio(audioElement);
```

After connecting the audio element, you can start the lipsyncing process by calling the `processAudio` method at the desired interval:

```javascript
const analyzeAudio = () => {
  requestAnimationFrame(analyzeAudio);
  lipsyncManager.processAudio();
  const viseme = lipsyncManager.viseme;
  // You can now use the viseme for your animation logic
  console.log(viseme);
};

analyzeAudio();
```

## Example

You can find a [complete example](https://github.com/wass08/wawa-lipsync/tree/main/examples/lipsync-demo) of how to use the library with Three.js and React Three Fiber in the `examples/lipsync-demo` directory of the repository.

> If you need help, join the [Discord server](https://wawasensei.dev/discord) or open an issue on the [GitHub repository](http://github.com/wass08/wawa-lipsync).

## Contributions

Contributions are welcome! If you have any ideas, suggestions, or improvements, feel free to open an issue or submit a pull request on the [GitHub repository](http://github.com/wass08/wawa-lipsync).

## License

This project is licensed under the MIT License. See the [LICENSE](https://github.com/wass08/wawa-lipsync/blob/main/LICENSE) for more details.
