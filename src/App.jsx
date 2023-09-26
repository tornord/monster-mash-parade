import * as THREE from "three";
import React, { useEffect, useRef } from "react";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import styled from "@emotion/styled";

const bezierPath = `
-4.7831525802612305 0.17447274923324585 -4.966528415679932 -0.7031381726264954 -4.317785263061523 2.4016544818878174
-1.0836405754089355 2.8587958812713623 -2.11867618560791 2.7133615016937256 -0.04860508441925049 3.004230260848999
2.1411399841308594 2.8587958812713623 1.200425148010254 3.0363972187042236 3.0818543434143066 2.681194543838501
4.128650665283203 1.9862298965454102 3.698558807373047 2.4408862590789795 4.5407795906066895 1.5505623817443848
4.564933776855469 -0.7284193634986877 4.777594566345215 0.8698856234550476 4.352272987365723 -2.3267245292663574
2.7228503227233887 -2.9583096504211426 3.5533666610717773 -3.244739294052124 2.0074353218078613 -2.711576223373413
1.6806191205978394 -0.7526572346687317 1.8647127151489258 -2.354503631591797 1.496525526046753 0.8491889834403992
-0.8886018991470337 1.0167124271392822 0.43619978427886963 1.422501802444458 -2.213404655456543 0.6109226942062378
-3.137185573577881 -1.7026143074035645 -1.597611427307129 -1.5316988229751587 -4.676761150360107 -1.8735299110412598
`
  .split("\n")
  .filter((d) => d !== "")
  .map((d) => d.split(" ").map((e) => Number(e)));

const StyledApp = styled.div(
  () => `
    .webgl
    {
        position: fixed;
        top: 0;
        left: 0;
        outline: none;

        // background: #11e8bb; /* Old browsers */
        background: linear-gradient(to bottom, #e3e9ec 0%, #a099a4 100%);
    }
  `
);

function getVertices(geo) {
  const position = geo.getAttribute("position");
  const res = [];
  const n = position.itemSize;
  for (let i = 0; i < position.count; i++) {
    const v = {
      x: position.array[i * n],
      y: position.array[i * n + 1],
      z: position.array[i * n + 2],
    };
    res.push(v);
  }
  return res;
}

export function App() {
  const ref = useRef(null);

  useEffect(() => {
    // Canvas
    const canvas = ref.current;

    // Scene
    const scene = new THREE.Scene();

    // GLTF loader
    const gltfLoader = new GLTFLoader();

    // Light
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x404040, 1.5);
    hemiLight.position.set(0, 1, 0);
    scene.add(hemiLight);

    const mixers = []; // Array of mixers in case of many models
    const lights = [];

    const runway = new THREE.CurvePath();
    for (let i = 0; i < bezierPath.length; i++) {
      const [x0, y0, , , xRight0, yRight0] = bezierPath[i];
      const [x1, y1, xLeft1, yLeft1] = bezierPath[(i + 1) % bezierPath.length];
      const b = new THREE.CubicBezierCurve3(
        new THREE.Vector3(x0, 0, -y0),
        new THREE.Vector3(xRight0, 0, -yRight0),
        new THREE.Vector3(xLeft1, 0, -yLeft1),
        new THREE.Vector3(x1, 0, -y1)
      );
      runway.add(b);
    }
    runway.autoClose = true;

    // Model
    gltfLoader.load("model.glb", (gltf) => {
      const model = gltf.scene;
      const mixer = new THREE.AnimationMixer(model);
      mixers.push(mixer);
      const objs = [];

      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          if (child.name === "Platform" || child.name === "Sandpath" || child.name === "Stonepath") {
            child.receiveShadow = true;
          }
          objs.push(child);
        } else if (child.isLight) {
          lights.push(child);
        }
      });

      scene.add(...objs);

      for (let i = 0; i < lights.length; i++) {
        const light = lights[i];
        light.intensity = i !== 2 ? 600 : 400;
        light.castShadow = true;
        light.shadow.radius = 4;
        light.shadow.mapSize.width = 2048;
        light.shadow.mapSize.height = 2048;
        scene.add(light);
      }
    });

    const mmScale = 0.2;
    const groundLevel = 0.1;

    const mmObjects = [];
    const mmColors = [316, 29, 230, 0, 200, 130, 264, 61].map((d) => `hsl(${d}, 100%, 25%)`);
    const mmFiles = ["mm_ball.glb"];

    for (const f of mmFiles) {
      gltfLoader.load(f, (gltf) => {
        const model = gltf.scene;
        const mixer = new THREE.AnimationMixer(model);
        mixers.push(mixer);
        const objs = [];

        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.material = new THREE.MeshStandardMaterial({
              depthTest: true,
              depthWrite: true,
              side: THREE.DoubleSide,
              color: new THREE.Color(mmColors[mmObjects.length % mmColors.length]),
            });
            const ps = getVertices(child.geometry);
            const m0 = Math.min(...ps.map((d) => d.y));

            child.scale.set(mmScale, mmScale, mmScale);
            child.position.y = -m0 * mmScale + groundLevel;
            mmObjects.push(child);
            objs.push(child);
          }
        });

        const actions = [];
        for (let i = 0; i < gltf.animations.length; i++) {
          const clip = gltf.animations[i];
          const action = mixer.clipAction(clip);
          action.setLoop(THREE.LoopRepeat);
          action.clampWhenFinished = true;
          action.enable = true;
          action.play();
          actions.push(action);
        }

        scene.add(...objs);
      });
    }

    // Window sizes
    const sizes = { width: window.innerWidth, height: window.innerHeight };

    // Base camera
    const camera = new THREE.PerspectiveCamera(45, sizes.width / sizes.height, 0.1, 100);
    camera.position.set(-6.2, 1.2, 2.3);
    scene.add(camera);

    // Controls
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0.0);
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.toneMappingExposure = 0.75;
    // renderer.useLegacyLights = true;

    window.addEventListener("resize", () => {
      // Update sizes
      sizes.width = window.innerWidth;
      sizes.height = window.innerHeight;

      // Update camera
      camera.aspect = sizes.width / sizes.height;
      camera.updateProjectionMatrix();

      // Update renderer
      renderer.setSize(sizes.width, sizes.height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    });

    // Animate
    const clock = new THREE.Clock();
    const tick = () => {
      const elapsedTime = clock.getElapsedTime(); // eslint-disable-line

      // Update controls
      controls.update();

      // Update animation mixers
      for (const mixer of mixers) {
        mixer.setTime(elapsedTime);
      }

      const setPos = (obj, startPos) => {
        const looptime = 30;
        const t = elapsedTime / looptime + startPos;
        const t0 = Math.floor(t);
        const f = t - t0;
        const up = new THREE.Vector3(0, 1, 0);
        const p = runway.getPoint(f);
        const tangent = runway.getTangent(f);
        obj.position.x = p.x;
        obj.position.z = p.z;

        const radians = Math.atan2(tangent.z, -tangent.x);
        obj.quaternion.setFromAxisAngle(up, radians);
      };

      for (let i = 0; i < mmObjects.length; i++) {
        const obj = mmObjects[i];
        setPos(obj, i / mmObjects.length);
      }

      // Render
      renderer.render(scene, camera);

      // Call tick again on the next frame
      window.requestAnimationFrame(tick);
    };

    tick();
  }, []);

  return (
    <StyledApp>
      <canvas ref={ref} className="webgl"></canvas>
    </StyledApp>
  );
}
