import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Config, ContactView } from "../simulation";

interface Props { contacts: ContactView[]; config: Config; selectedId: string | null; onSelect: (id: string) => void }

function visualStatusColor(status?: ContactView["status"]) {
  if (status === "TRACK") return 0x51c9a5;
  if (status === "INTERMITTENT") return 0xf4bd58;
  if (status === "UNOBSERVED") return 0x82909c;
  return 0x8a9ba5;
}

export default function DigitalTwin({ contacts, config, selectedId, onSelect }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onSelect);
  const contactRef = useRef(contacts);
  const selectionRef = useRef(selectedId);
  callbackRef.current = onSelect;
  contactRef.current = contacts;
  selectionRef.current = selectedId;
  const contactKey = contacts.map((contact) => contact.id).join("|");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    const scene = new THREE.Scene();
    const night = config.lighting === "night";
    const dusk = config.lighting === "dusk";
    scene.background = new THREE.Color(night ? "#07111b" : dusk ? "#2a2331" : "#b8c9ca");
    scene.fog = new THREE.Fog(scene.background, config.visibility === "fog" ? 16 : config.visibility === "haze" ? 26 : 45, 130);
    const camera = new THREE.PerspectiveCamera(48, 1, .1, 300);
    camera.position.set(0, 36, 58);
    camera.lookAt(0, 0, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(night ? 0x7a9ac1 : 0xe6f5ff, 0x263a3e, night ? 1.25 : 2.1));
    const sun = new THREE.DirectionalLight(night ? 0x89a9ff : dusk ? 0xffbb89 : 0xfff0d7, night ? 1.1 : 2.3);
    sun.position.set(-22, 40, 18); scene.add(sun);
    const groundColor = config.environment === "urban" ? (night ? 0x18242b : 0x7d8988) : config.environment === "rural" ? (night ? 0x152a2a : 0x738c70) : (night ? 0x1a2c30 : 0x89978a);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 100), new THREE.MeshStandardMaterial({ color: groundColor, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -.35; scene.add(ground);
    const grid = new THREE.GridHelper(120, 24, night ? 0x2c6470 : 0x657d7b, night ? 0x1b3b45 : 0x81928d);
    grid.position.y = -.28; scene.add(grid);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(120, 9), new THREE.MeshStandardMaterial({ color: night ? 0x17242c : 0x697272, roughness: 1 }));
    road.rotation.x = -Math.PI / 2; road.position.set(0, -.22, 8); scene.add(road);
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(120, .18), new THREE.MeshBasicMaterial({ color: night ? 0x52616c : 0xc2c6ad }));
    lane.rotation.x = -Math.PI / 2; lane.position.set(0, -.2, 8); scene.add(lane);
    const buildingMat = new THREE.MeshStandardMaterial({ color: night ? 0x354653 : 0xc0c2b7, roughness: .9 });
    const roofMat = new THREE.MeshStandardMaterial({ color: night ? 0x243640 : 0x8b9692, roughness: .9 });
    const treeMat = new THREE.MeshStandardMaterial({ color: night ? 0x1e433c : 0x3d7056, roughness: 1 });
    const treeTrunk = new THREE.MeshStandardMaterial({ color: 0x554a3d, roughness: 1 });
    if (config.environment === "urban") {
      for (let i = 0; i < 17; i++) {
        const x = ((i * 19) % 86) - 43, z = ((i * 13) % 55) - 30;
        if (Math.abs(z - 8) < 8) continue;
        const w = 4 + (i % 3) * 1.8, h = 3 + (i % 5) * 1.7, d = 4 + (i % 4) * 1.3;
        const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), buildingMat);
        building.position.set(x, h / 2 - .3, z); scene.add(building);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + .18, .22, d + .18), roofMat);
        roof.position.set(x, h - .3, z); scene.add(roof);
      }
    } else {
      for (let i = 0; i < 25; i++) {
        const x = ((i * 23) % 102) - 51, z = ((i * 17) % 78) - 39;
        if (Math.abs(z - 8) < 8) continue;
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.15, .22, 1.8, 5), treeTrunk);
        trunk.position.set(x, .55, z);
        const crown = new THREE.Mesh(new THREE.ConeGeometry(1.1 + (i % 3) * .25, 3 + (i % 2), 6), treeMat);
        crown.position.set(x, 2.5, z); scene.add(trunk, crown);
      }
      if (config.environment === "perimeter") {
        const fenceMat = new THREE.MeshStandardMaterial({ color: night ? 0x405d67 : 0xa8b7b0, roughness: 1 });
        for (let x = -48; x <= 48; x += 4) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(.13, 1.6, .13), fenceMat);
          post.position.set(x, .45, -35); scene.add(post);
        }
        const rail = new THREE.Mesh(new THREE.BoxGeometry(100, .1, .1), fenceMat);
        rail.position.set(0, .85, -35); scene.add(rail);
      }
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.1, .7, 8), new THREE.MeshStandardMaterial({ color: night ? 0x294650 : 0x465e5a, roughness: 1 }));
    hub.position.set(-37, 0, 28); scene.add(hub);
    const hubTop = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, .12, 16), new THREE.MeshStandardMaterial({ color: 0x79bca8, roughness: .8 }));
    hubTop.position.set(-37, .42, 28); scene.add(hubTop);

    const contactMeshes = new Map<string, THREE.Group>();
    const contactMaterials = new Map<string, THREE.MeshStandardMaterial>();
    const pickables: THREE.Object3D[] = [];
    contactRef.current.forEach((contact) => {
      const group = new THREE.Group();
      const material = new THREE.MeshStandardMaterial({ color: 0xaebbc1, emissive: 0x41535b, emissiveIntensity: .18, roughness: .65 });
      // Neutral marker geometry avoids visually declaring an uncertain contact to be a drone.
      const body = new THREE.Mesh(new THREE.OctahedronGeometry(.62, 0), material); group.add(body);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, 1.1, 5), material);
      stem.position.y = -.72; group.add(stem);
      const halo = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.36, 32), new THREE.MeshBasicMaterial({ color: 0x9fb1ba, transparent: true, opacity: .45, side: THREE.DoubleSide }));
      halo.rotation.x = -Math.PI / 2; halo.position.y = -.75; group.add(halo);
      group.userData.entityId = contact.id;
      group.visible = typeof contact.x === "number" && typeof contact.y === "number";
      group.position.set(((contact.x ?? 0.5) - .5) * 100, (contact.altitude ?? 80) / 15, ((contact.y ?? 0.5) - .5) * 80);
      scene.add(group); contactMeshes.set(contact.id, group); contactMaterials.set(contact.id, material); pickables.push(body);
    });
    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
    const onPointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(pickables, false)[0];
      const id = hit?.object.parent?.userData.entityId;
      if (typeof id === "string") callbackRef.current(id);
    };
    renderer.domElement.addEventListener("pointerdown", onPointer);
    const resize = () => { const width = Math.max(host.clientWidth, 1), height = Math.max(host.clientHeight, 1); camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false); };
    resize();
    const observer = new ResizeObserver(resize); observer.observe(host);
    let raf = 0;
    const animate = () => {
      if (disposed) return;
      raf = requestAnimationFrame(animate);
      contactMeshes.forEach((group, id) => {
        const contact = contactRef.current.find((item) => item.id === id);
        const status = contact?.status;
        const hasPosition = typeof contact?.x === "number" && typeof contact?.y === "number";
        group.visible = hasPosition;
        if (hasPosition && contact) {
          group.position.set((contact.x! - .5) * 100, (contact.altitude ?? 80) / 15, (contact.y! - .5) * 80);
        }
        const selected = id === selectionRef.current;
        const material = contactMaterials.get(id);
        if (material) {
          const color = visualStatusColor(status);
          material.color.setHex(color);
          material.emissive.setHex(color);
          material.emissiveIntensity = selected ? .65 : status === "UNOBSERVED" ? .03 : .18;
        }
        const halo = group.children[group.children.length - 1];
        if (halo instanceof THREE.Mesh && halo.material instanceof THREE.MeshBasicMaterial) halo.material.color.setHex(visualStatusColor(status));
        group.scale.setScalar(selected ? 1.15 : status === "UNOBSERVED" ? .82 : 1);
      });
      renderer.render(scene, camera);
    };
    animate();
    return () => {
      disposed = true; cancelAnimationFrame(raf); observer.disconnect();
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
  }, [config.environment, config.lighting, config.visibility, contactKey]);

  return <div className="twin-stage"><div className="twin-badge"><span className="live-dot" /> OBSERVATION-BASED VIEW <span className="separator">/</span> LAST KNOWN POSITIONS</div><div className="twin-overlay top-right"><span>ENV</span><strong>{config.environment.toUpperCase()}</strong><span>LIGHT</span><strong>{config.lighting.toUpperCase()}</strong></div><div className="twin-overlay bottom-left"><span>SENSOR VIEW</span><strong>{contacts.filter((contact) => typeof contact.x === "number" && typeof contact.y === "number").length} LOCATED CONTACTS</strong></div><div ref={hostRef} className="three-host" /></div>;
}
