import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

export default function Character3D({
  modelUrl,
  animate = 'idle',
  position = [0, 0, 0],
  scale = 1,
  className = '',
  forceRender = false,
  rotation = [0, 0, 0],
  vrmaUrl = null,
  expression = 'relaxed'
}) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      30,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      20
    );
    camera.position.set(0, 0.8, 3);

    // Renderer - aggressive optimizations
    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
      precision: 'lowp',
      failIfMajorPerformanceCaveat: false
    });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
    renderer.shadowMap.enabled = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.debug.checkShaderErrors = false;

    containerRef.current.appendChild(renderer.domElement);

    // Lighting
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(1, 2, 3);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    // Load VRM
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    let vrm = null;
    let mixer = null;
    let currentAction = null;
    let allAnimations = {};
    const clock = new THREE.Clock();
    let t = 0;
    let lastExpression = null;

    const playAnimation = (animType) => {
      if (!mixer) return;

      // Stop current animation
      if (currentAction) currentAction.stop();

      // Find animation by type - try to match by name
      let animationClip = null;
      const clips = Object.values(allAnimations);

      if (animType === 'walk') {
        animationClip = clips.find(c => c.name.toLowerCase().includes('walk')) || clips[0];
      } else if (animType === 'run') {
        animationClip = clips.find(c => c.name.toLowerCase().includes('run')) || clips[0];
      } else if (animType === 'idle') {
        animationClip = clips.find(c => c.name.toLowerCase().includes('idle')) || clips[0];
      }

      if (!animationClip && clips.length > 0) {
        animationClip = clips[0]; // Fallback to first animation
      }

      if (animationClip) {
        currentAction = mixer.clipAction(animationClip);
        currentAction.loop = THREE.LoopRepeat;
        currentAction.clampWhenFinished = false;
        currentAction.play();
      }
    };

    loader.load(
      modelUrl,
      (gltf) => {
        vrm = gltf.userData.vrm;
        if (!vrm) {
          console.error('No VRM data found');
          return;
        }

        VRMUtils.removeUnnecessaryJoints(vrm.scene);

        // Optimize materials for performance
        vrm.scene.traverse((node) => {
          if (node.material) {
            node.material.fog = false;
            node.material.side = THREE.FrontSide;
            if (node.material.wireframe === undefined) {
              node.material.wireframe = false;
            }
          }
        });

        vrm.scene.position.set(...position);
        vrm.scene.scale.set(scale, scale, scale);
        vrm.scene.rotation.set(...rotation);
        scene.add(vrm.scene);

        // Pose the arms naturally (drop from T-pose)
        const leftArm = vrm.humanoid.getNormalizedBoneNode('leftUpperArm');
        const rightArm = vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
        if (leftArm) leftArm.rotation.z = -1.1;
        if (rightArm) rightArm.rotation.z = 1.1;

        // Setup animations - map all animations
        if (gltf.animations && gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(vrm.scene);

          gltf.animations.forEach((clip) => {
            const name = clip.name.toLowerCase();
            allAnimations[name] = clip;
            if (name.includes('walk')) allAnimations.walk = clip;
            if (name.includes('run')) allAnimations.run = clip;
            if (name.includes('idle')) allAnimations.idle = clip;
          });

          console.log('Available animations:', gltf.animations.map(c => c.name));
          // Start with the current animation type
          playAnimation(animate);
        } else {
          console.warn('No animations found in model');
        }

        // Blinking
        function blink() {
          const nextBlink = 2000 + Math.random() * 4000;
          setTimeout(() => {
            if (vrm && vrm.expressionManager) {
              vrm.expressionManager.setValue('blinkLeft', 1);
              vrm.expressionManager.setValue('blinkRight', 1);
              setTimeout(() => {
                if (vrm && vrm.expressionManager) {
                  vrm.expressionManager.setValue('blinkLeft', 0);
                  vrm.expressionManager.setValue('blinkRight', 0);
                }
                blink();
              }, 150);
            }
          }, nextBlink);
        }
        blink();

        // Load VRMA animation if provided
        if (vrmaUrl) {
          const vrmaLoader = new GLTFLoader();
          vrmaLoader.register((parser) => new VRMLoaderPlugin(parser));
          vrmaLoader.load(
            vrmaUrl,
            (vrmaGltf) => {
              const vrmaAnimations = vrmaGltf.animations;
              console.log('VRMA animations found:', vrmaAnimations.length);
              if (vrmaAnimations && vrmaAnimations.length > 0) {
                if (!mixer) {
                  mixer = new THREE.AnimationMixer(vrm.scene);
                  console.log('Created mixer for VRMA');
                }
                const vrmaClip = vrmaAnimations[0];
                console.log('Playing animation:', vrmaClip.name);
                const action = mixer.clipAction(vrmaClip);
                action.loop = THREE.LoopRepeat;
                action.timeScale = 1.3;
                action.play();
                console.log('VRMA animation playing:', vrmaUrl);
              } else {
                console.warn('No animations in VRMA file');
              }
            },
            undefined,
            (error) => console.error('VRMA Loading error:', error)
          );
        }
      },
      undefined,
      (error) => console.error('VRM Loading error:', error)
    );

    // Animation loop with frame rate capping (60 FPS max)
    let lastFrameTime = performance.now();
    const MAX_FPS = 60;
    const FRAME_TIME = 1000 / MAX_FPS;
    let lastAnimationType = animate;
    let accumulator = 0;

    function animateFrame(currentTime) {
      requestAnimationFrame(animateFrame);

      // Only render if enough time has passed
      const deltaRealTime = currentTime - lastFrameTime;
      if (deltaRealTime < FRAME_TIME) {
        return;
      }

      lastFrameTime = currentTime - (deltaRealTime % FRAME_TIME);
      const delta = Math.min(clock.getDelta(), FRAME_TIME / 1000);
      t += delta;

      // Switch animation if type changed
      if (animate !== lastAnimationType) {
        playAnimation(animate);
        lastAnimationType = animate;
      }

      if (vrm) {
        // Apply expression only if it changed
        if (vrm.expressionManager && lastExpression !== expression) {
          const expressions = ['relaxed', 'happy', 'sad', 'angry', 'Surprised'];
          expressions.forEach(exp => {
            vrm.expressionManager.setValue(exp, exp === expression ? 1 : 0);
          });
          lastExpression = expression;
        }
        // Only add idle bounce when actually idling
        if (animate === 'idle') {
          const spine = vrm.humanoid.getNormalizedBoneNode('spine');
          const hips = vrm.humanoid.getNormalizedBoneNode('hips');
          const leftShoulder = vrm.humanoid.getNormalizedBoneNode('leftShoulder');
          const rightShoulder = vrm.humanoid.getNormalizedBoneNode('rightShoulder');

          // Tiny vertical bounce (very subtle, not floating)
          if (hips) hips.position.y = Math.sin(t * 1.5) * 0.008;

          // Main body sway - this creates the "bounce" feeling
          if (spine) {
            spine.rotation.z = Math.sin(t * 1.2) * 0.05;
            spine.rotation.x = Math.sin(t * 0.8) * 0.02;
          }

          // Shoulders bob with spine
          if (leftShoulder) {
            leftShoulder.rotation.z = Math.sin(t * 1.2 + Math.PI / 4) * 0.03;
          }
          if (rightShoulder) {
            rightShoulder.rotation.z = Math.sin(t * 1.2 - Math.PI / 4) * 0.03;
          }
        }

        vrm.update(delta);
      }

      if (mixer) mixer.update(delta);

      renderer.render(scene, camera);
    }

    animateFrame(performance.now());

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (vrm) {
        scene.remove(vrm.scene);
      }
      renderer.dispose();
      if (containerRef.current?.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [modelUrl, animate, position, scale, rotation, expression]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    />
  );
}
