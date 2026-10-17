import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Config, Entity, Observation } from "../simulation";

interface Props {
  entities: Entity[];
  config: Config;
  observations: Record<string, Observation>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function DigitalTwin({ entities, config, observations, selectedId, onSelect }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const night = config.lighting === "night";
    const dusk = config.lighting === "dusk";
    scene.background = new THREE.Color(night ? "#07111b" : dusk ? "#2a2331" : "#b8c9ca");
    scene.fog = new THREE.Fog(scene.background, config.visibility === "fog" ? 16 : config.visibility === "haze" ? 26 : 45, 130);

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 300);
    camera.position.set(0, 36, 58);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const hemisphere = new THREE.HemisphereLight(night ? 0x7a9ac1 : 0xe6f5ff, 0x263a3e, night ? 1.25 : 2.1);
    scene.add(hemisphere);
    const sun = new THREE.DirectionalLight(night ? 0x89a9ff : dusk ? 0xffbb89 : 0xfff0d7, night ? 1.1 : 2.3);
    sun.position.set(-22, 40, 18);
    scene.add(sun);

    const groundColor = config.environment === "urban" ? (night ? 0x18242b : 0x7d8988)
      : config.environment === "rural" ? (night ? 0x152a2a : 0x738c70)
      : (night ? 0x1a2c30 : 0x89978a);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 100), new THREE.MeshStandardMaterial({ color: groundColor, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.35;
    scene.add(ground);

    const grid = new THREE.GridHelper(120, 24, night ? 0x2c6470 : 0x657d7b, night ? 0x1b3b45 : 0x81928d);
    grid.position.y = -0.28;
    scene.add(grid);

    const roadMaterial = new THREE.MeshStandardMaterial({ color: night ? 0x17242c : 0x697272, roughness: 1 });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(120, 9), roadMaterial);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, -0.22, 8);
    scene.add(road);
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(120, 0.18), new THREE.MeshBasicMaterial({ color: night ? 0x52616c : 0xc2c6ad }));
    lane.rotation.x = -Math.PI / 2;
    lane.position.set(0, -0.2, 8);
    scene.add(lane);

    const buildingMat = new THREE.MeshStandardMaterial({ color: night ? 0x354653 : 0xc0c2b7, roughness: 0.9 });
    const roofMat = new THREE.MeshStandardMaterial({ color: night ? 0x243640 : 0x8b9692, roughness: 0.9 });
    const treeMat = new THREE.MeshStandardMaterial({ color: night ? 0x1e433c : 0x3d7056, roughness: 1 });
    const treeTrunk = new THREE.MeshStandardMaterial({ color: 0x554a3d, roughness: 1 });

    if (config.environment === "urban") {
      for (let i = 0; i < 17; i++) {
        const x = ((i * 19) % 86) - 43;
        const z = ((i * 13) % 55) - 30;
        if (Math.abs(z - 8) < 8) continue;
        const w = 4 + (i % 3) * 1.8;
        const h = 3 + (i % 5) * 1.7;
        const d = 4 + (i % 4) * 1.3;
        const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), buildingMat);
        building.position.set(x, h / 2 - 0.3, z);
        scene.add(building);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + .18, .22, d + .18), roofMat);
        roof.position.set(x, h - .3, z);
        scene.add(roof);
        const windowsMat = new THREE.MeshBasicMaterial({ color: night ? 0xf1bd66 : 0x34474d });
        for (let floor = 0; floor < Math.min(3, Math.floor(h / 2)); floor++) {
          for (let col = 0; col < Math.max(1, Math.floor(w / 2.2)); col++) {
            const windowMesh = new THREE.Mesh(new THREE.PlaneGeometry(.42, .35), windowsMat);
            windowMesh.position.set(x - w * .28 + col * 1.25, 0.8 + floor * 1.4, z + d / 2 + .012);
            scene.add(windowMesh);
          }
        }
      }
    } else {
      for (let i = 0; i < 25; i++) {
        const x = ((i * 23) % 102) - 51;
        const z = ((i * 17) % 78) - 39;
        if (Math.abs(z - 8) < 8) continue;
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.15, .22, 1.8, 5), treeTrunk);
        trunk.position.set(x, .55, z);
        const crown = new THREE.Mesh(new THREE.ConeGeometry(1.1 + (i % 3) * .25, 3 + (i % 2), 6), treeMat);
        crown.position.set(x, 2.5, z);
        scene.add(trunk, crown);
      }
      if (config.environment === "perimeter") {
        const fenceMat = new THREE.MeshStandardMaterial({ color: night ? 0x405d67 : 0xa8b7b0, roughness: 1 });
        for (let x = -48; x <= 48; x += 4) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(.13, 1.6, .13), fenceMat);
          post.position.set(x, .45, -35);
          scene.add(post);
        }
        const rail = new THREE.Mesh(new THREE.BoxGeometry(100, .1, .1), fenceMat);
        rail.position.set(0, .85, -35);
        scene.add(rail);
      }
    }

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.1, .7, 8), new THREE.MeshStandardMaterial({ color: night ? 0x294650 : 0x465e5a, roughness: 1 }));
    hub.position.set(-37, 0, 28);
    scene.add(hub);
    const hubTop = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, .12, 16), new THREE.MeshStandardMaterial({ color: 0x79bca8, roughness: .8 }));
    hubTop.position.set(-37, .42, 28);
    scene.add(hubTop);

    const entityMeshes = new Map<string, THREE.Group>();
    const entityMaterials = new Map<string, THREE.MeshStandardMaterial>();
    const pickables: THREE.Object3D[] = [];
    entities.forEach((entity) => {
      const group = new THREE.Group();
      const color = entity.kind === "authorized" ? 0x51c9a5 : entity.kind === "unknown" ? 0xf4bd58 : 0xff667f;
      const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .25, roughness: .6 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, .35, .8), material);
      group.add(body);
      for (const [x, z] of [[-.9, -.7], [-.9, .7], [.9, -.7], [.9, .7]]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(.8, .09, .09), material);
        arm.position.set(x * .42, 0, z * .35);
        group.add(arm);
        const rotor = new THREE.Mesh(new THREE.TorusGeometry(.27, .035, 5, 12), material);
        rotor.rotation.x = Math.PI / 2;
        rotor.position.set(x, .05, z);
        group.add(rotor);
      }
      const halo = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.36, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .55, side: THREE.DoubleSide }));
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = -entity.altitude / 130;
      group.add(halo);
      group.userData.entityId = entity.id;
      group.position.set((entity.x - .5) * 100, entity.altitude / 15, (entity.y - .5) * 80);
      scene.add(group);
      entityMeshes.set(entity.id, group);
      entityMaterials.set(entity.id, material);
      pickables.push(body);
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onPointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(pickables, false)[0];
      if (hit) {
        const group = hit.object.parent;
        const id = group?.userData.entityId;
        if (typeof id === "string") selectRef.current(id);
      }
    };
    renderer.domElement.addEventListener("pointerdown", onPointer);

    let frame = 0;
    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      frame += 1;
      entityMeshes.forEach((group, id) => {
        group.rotation.y += .002;
        const entity = entities.find((item) => item.id === id);
        const obs = observations[id];
        if (entity) {
          group.position.set((entity.x - .5) * 100, entity.altitude / 15 + Math.sin(frame * .015 + entity.phase) * .35, (entity.y - .5) * 80);
        }
        const selected = id === selectedId;
        const material = entityMaterials.get(id);
        if (material) {
          material.emissiveIntensity = selected ? .7 : obs?.status === "UNOBSERVED" ? .05 : .24;
          material.opacity = 1;
        }
        group.scale.setScalar(selected ? 1.15 : obs?.status === "UNOBSERVED" ? .82 : 1);
      });
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointer);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
    };
  }, [config.environment, config.lighting, config.visibility, entities, observations, selectedId]);

  return (
    <div className="twin-stage">
      <div className="twin-badge"><span className="live-dot" /> DIGITAL TWIN <span className="separator">/</span> SYNCHRONIZED</div>
      <div className="twin-overlay top-right">
        <span>ENV</span><strong>{config.environment.toUpperCase()}</strong>
        <span>LIGHT</span><strong>{config.lighting.toUpperCase()}</strong>
      </div>
      <div className="twin-overlay bottom-left">
        <span>SIMULATION VIEW</span><strong>{entities.length} SYNTHETIC ENTITIES</strong>
      </div>
      <div ref={hostRef} className="three-host" />
    </div>
  );
}
