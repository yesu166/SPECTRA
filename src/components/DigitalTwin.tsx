import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type {
  Config, ContactClassification, ConfidenceLevel, ContactView, InputMethod, TraineeAction,
} from "../simulation";

type ViewMode = "standard" | "phone" | "cardboard";

interface Props {
  contacts: ContactView[];
  config: Config;
  selectedId: string | null;
  onSelect: (id: string) => void;
  elapsedSeconds: number;
  isRunning: boolean;
  onToggleSimulation: (inputMethod?: InputMethod) => void;
  onTraineeAction: (
    action: TraineeAction,
    confidence: ConfidenceLevel,
    inputMethod: InputMethod,
    classification?: ContactClassification,
    contactId?: string,
  ) => void;
}

interface HudButtonSpec {
  label: string;
  action?: TraineeAction;
  confidence?: ConfidenceLevel;
  classification?: ContactClassification;
  simulationControl?: boolean;
  exit?: boolean;
}

const HUD_BUTTONS: HudButtonSpec[] = [
  { label: "OBSERVE", action: "OBSERVE" },
  { label: "MORE INFO", action: "REQUEST_MORE_INFO" },
  { label: "REPORT", action: "REPORT" },
  { label: "ESCALATE", action: "ESCALATE" },
  { label: "AUTHORISE", action: "AUTHORIZE_RESPONSE" },
  { label: "DEFER", action: "DEFER" },
  { label: "DRONE?", action: "CLASSIFY", classification: "POSSIBLE_DRONE" },
  { label: "NON-DRONE", action: "CLASSIFY", classification: "NON_DRONE" },
  { label: "UNKNOWN", action: "CLASSIFY", classification: "UNKNOWN" },
  { label: "CONF LOW", action: "SET_CONFIDENCE", confidence: "LOW" },
  { label: "CONF MED", action: "SET_CONFIDENCE", confidence: "MEDIUM" },
  { label: "CONF HIGH", action: "SET_CONFIDENCE", confidence: "HIGH" },
  { label: "RUN / PAUSE", simulationControl: true },
  { label: "EXIT VIEW", exit: true },
];

function visualStatusColor(status?: ContactView["status"]) {
  if (status === "TRACK") return 0x51c9a5;
  if (status === "INTERMITTENT") return 0xf4bd58;
  if (status === "UNOBSERVED") return 0x82909c;
  return 0x8a9ba5;
}

function timeLabel(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}

function buildButtonTexture(label: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas text rendering is unavailable");
  context.fillStyle = "#08151c";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#67d7b2";
  context.lineWidth = 5;
  context.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
  context.fillStyle = "#e5f2ef";
  context.font = "bold 35px monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, canvas.width / 2, canvas.height / 2, canvas.width - 34);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildStatusTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 104;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas text rendering is unavailable");
  return { canvas, context, texture: new THREE.CanvasTexture(canvas) };
}

export default function DigitalTwin({
  contacts, config, selectedId, onSelect, elapsedSeconds, isRunning, onToggleSimulation, onTraineeAction,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const resizeRef = useRef<(() => void) | null>(null);
  const applyModeRef = useRef<((mode: ViewMode) => void) | null>(null);
  const refreshContactsRef = useRef<(() => void) | null>(null);
  const recenterHudRef = useRef<(() => void) | null>(null);
  const callbackRef = useRef(onSelect);
  const actionRef = useRef(onTraineeAction);
  const contactRef = useRef(contacts);
  const selectionRef = useRef(selectedId);
  const elapsedRef = useRef(elapsedSeconds);
  const runningRef = useRef(isRunning);
  const toggleSimulationRef = useRef(onToggleSimulation);
  const modeRef = useRef<ViewMode>("standard");
  const confidenceRef = useRef<ConfidenceLevel>("MEDIUM");
  const gazeTargetRef = useRef<THREE.Object3D | null>(null);
  const gazeStartRef = useRef(0);
  const gazeFiredRef = useRef(false);
  const orientationBaselineRef = useRef<THREE.Quaternion | null>(null);
  const cameraBaselineRef = useRef<THREE.Quaternion | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("standard");
  const [motionEnabled, setMotionEnabled] = useState(false);
  const [motionMessage, setMotionMessage] = useState("Motion view is off");
  const [confidence, setConfidence] = useState<ConfidenceLevel>("MEDIUM");
  const contactKey = contacts.map((contact) => contact.id).join("|");

  callbackRef.current = onSelect;
  actionRef.current = onTraineeAction;
  contactRef.current = contacts;
  selectionRef.current = selectedId;
  elapsedRef.current = elapsedSeconds;
  runningRef.current = isRunning;
  toggleSimulationRef.current = onToggleSimulation;
  modeRef.current = viewMode;
  confidenceRef.current = confidence;

  const reportAction = useCallback((
    spec: HudButtonSpec,
    inputMethod: InputMethod,
    contactId = selectionRef.current ?? undefined,
  ) => {
    if (spec.simulationControl) {
      toggleSimulationRef.current(inputMethod);
      return;
    }
    if (spec.exit) {
      modeRef.current = "standard";
      setViewMode("standard");
      setMotionEnabled(false);
      setMotionMessage("Phone view stopped");
      return;
    }
    if (spec.confidence) {
      confidenceRef.current = spec.confidence;
      setConfidence(spec.confidence);
    }
    if (spec.action) {
      actionRef.current(
        spec.action,
        spec.confidence ?? confidenceRef.current,
        inputMethod,
        spec.classification,
        contactId,
      );
    }
  }, []);

  const activateMode = useCallback(async (nextMode: ViewMode) => {
    if (nextMode === "standard") {
      setViewMode("standard");
      setMotionEnabled(false);
      setMotionMessage("Standard 3D view");
      return;
    }
    if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) {
      setMotionMessage("This browser does not expose phone motion sensors.");
      return;
    }
    const localHost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    if (!window.isSecureContext && !localHost) {
      setMotionMessage("Phone motion requires HTTPS. Open SPECTRA from a secure hosted URL.");
      return;
    }
    try {
      const orientationConstructor = DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<"granted" | "denied">;
      };
      if (typeof orientationConstructor.requestPermission === "function") {
        const permission = await orientationConstructor.requestPermission();
        if (permission !== "granted") {
          setMotionMessage("Motion permission was not granted. Allow motion access and retry.");
          return;
        }
      }
      orientationBaselineRef.current = null;
      cameraBaselineRef.current = null;
      setMotionEnabled(true);
      setViewMode(nextMode);
      setMotionMessage(nextMode === "cardboard" ? "Cardboard stereo · turn the phone to look" : "Phone motion enabled · turn to look");
    } catch {
      setMotionMessage("Could not start motion tracking. Check browser permission and HTTPS.");
    }
  }, []);

  useEffect(() => {
    if (!motionEnabled || (viewMode !== "phone" && viewMode !== "cardboard")) return;
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha === null || event.beta === null || event.gamma === null) return;
      const camera = cameraRef.current;
      if (!camera) return;
      const radians = Math.PI / 180;
      const euler = new THREE.Euler(event.beta * radians, event.alpha * radians, -event.gamma * radians, "YXZ");
      const raw = new THREE.Quaternion().setFromEuler(euler);
      const screenAngle = window.screen.orientation?.angle ?? (typeof window.orientation === "number" ? window.orientation : 0);
      raw.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
      raw.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -screenAngle * radians));
      if (!orientationBaselineRef.current) {
        orientationBaselineRef.current = raw.clone();
        cameraBaselineRef.current = camera.quaternion.clone();
      }
      const delta = orientationBaselineRef.current.clone().invert().multiply(raw);
      camera.quaternion.copy(cameraBaselineRef.current ?? camera.quaternion).multiply(delta);
      camera.updateMatrixWorld();
    };
    window.addEventListener("deviceorientation", handleOrientation, true);
    return () => window.removeEventListener("deviceorientation", handleOrientation, true);
  }, [motionEnabled, viewMode]);

  useEffect(() => {
    applyModeRef.current?.(viewMode);
  }, [viewMode]);

  useEffect(() => {
    refreshContactsRef.current?.();
  }, [contacts]);

  useEffect(() => {
    if (viewMode === "cardboard") recenterHudRef.current?.();
    resizeRef.current?.();
  }, [viewMode]);

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
    const gazeReticleMaterial = new THREE.MeshBasicMaterial({ color: 0x9be9ce, transparent: true, opacity: .9, side: THREE.DoubleSide, depthTest: false });
    const gazeReticle = new THREE.Mesh(new THREE.RingGeometry(.025, .043, 20), gazeReticleMaterial);
    gazeReticle.position.set(0, 0, -1.2);
    gazeReticle.renderOrder = 20;
    gazeReticle.visible = false;
    camera.add(gazeReticle);
    const standardPosition = new THREE.Vector3(0, 36, 58);
    const phonePosition = new THREE.Vector3(0, 7, 32);
    camera.position.copy(standardPosition);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.35));
    renderer.shadowMap.enabled = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    scene.add(camera);
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
    const contactById = new Map<string, ContactView>();
    const pickables: THREE.Object3D[] = [];
    contactRef.current.forEach((contact) => {
      contactById.set(contact.id, contact);
      const group = new THREE.Group();
      const material = new THREE.MeshStandardMaterial({ color: 0xaebbc1, emissive: 0x41535b, emissiveIntensity: .18, roughness: .65 });
      const body = new THREE.Mesh(new THREE.OctahedronGeometry(.62, 0), material);
      group.add(body);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, 1.1, 5), material);
      stem.position.y = -.72;
      group.add(stem);
      const halo = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.36, 32), new THREE.MeshBasicMaterial({ color: 0x9fb1ba, transparent: true, opacity: .45, side: THREE.DoubleSide }));
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = -.75;
      group.add(halo);
      group.userData.contactId = contact.id;
      group.visible = typeof contact.x === "number" && typeof contact.y === "number";
      group.position.set(((contact.x ?? .5) - .5) * 100, (contact.altitude ?? 80) / 15, ((contact.y ?? .5) - .5) * 80);
      scene.add(group);
      contactMeshes.set(contact.id, group);
      contactMaterials.set(contact.id, material);
      pickables.push(body);
      gazePickables.push(body);
    });

    const hudRoot = new THREE.Group();
    hudRoot.visible = false;
    scene.add(hudRoot);
    const hudButtons: THREE.Mesh[] = [];
    const buttonSpecs = new Map<THREE.Object3D, HudButtonSpec>();
    const gazePickables: THREE.Object3D[] = [];
    HUD_BUTTONS.forEach((spec, index) => {
      const row = Math.floor(index / 3);
      const column = index % 3;
      const texture = buildButtonTexture(spec.label);
      const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, depthWrite: false });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.12, .28), material);
      mesh.position.set((column - 1) * 1.24, -.35 - row * .33, 0);
      mesh.userData.hudAction = spec.label;
      hudRoot.add(mesh);
      hudButtons.push(mesh);
      gazePickables.push(mesh);
      buttonSpecs.set(mesh, spec);
    });
    const statusDrawing = buildStatusTexture();
    statusDrawing.texture.colorSpace = THREE.SRGBColorSpace;
    const statusMaterial = new THREE.MeshBasicMaterial({ map: statusDrawing.texture, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    const statusMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.85, .37), statusMaterial);
    statusMesh.position.set(0, .2, 0);
    hudRoot.add(statusMesh);

    const eyeCamera = new THREE.StereoCamera();
    eyeCamera.eyeSep = .064;
    const raycaster = new THREE.Raycaster();
    const center = new THREE.Vector2(0, 0);
    const pointer = new THREE.Vector2();
    const onPointer = (event: PointerEvent) => {
      if (modeRef.current === "cardboard") return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(pickables, false)[0];
      const id = hit?.object.parent?.userData.contactId;
      if (typeof id === "string") callbackRef.current(id);
    };
    renderer.domElement.addEventListener("pointerdown", onPointer);

    let width = 1;
    let height = 1;
    const resize = () => {
      width = Math.max(host.clientWidth, 1);
      height = Math.max(host.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = (modeRef.current === "cardboard" ? width / 2 : width) / height;
      camera.updateProjectionMatrix();
      renderer.setScissorTest(modeRef.current === "cardboard");
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    rendererRef.current = renderer;
    resizeRef.current = resize;
    recenterHudRef.current = () => {
      const direction = camera.getWorldDirection(new THREE.Vector3()).normalize();
      hudRoot.position.copy(camera.position).add(direction.multiplyScalar(4.7));
      hudRoot.quaternion.copy(camera.quaternion);
      hudRoot.position.add(new THREE.Vector3(0, -.08, 0));
    };
    applyModeRef.current = (mode) => {
      gazeTargetRef.current = null;
      gazeStartRef.current = 0;
      gazeFiredRef.current = false;
      if (mode === "standard") {
        hudRoot.visible = false;
        gazeReticle.visible = false;
        camera.position.copy(standardPosition);
        camera.lookAt(0, 0, 0);
      } else {
        camera.position.copy(phonePosition);
        camera.lookAt(0, 7, 0);
        hudRoot.visible = mode === "cardboard";
        gazeReticle.visible = mode === "cardboard";
        if (mode === "cardboard") recenterHudRef.current?.();
      }
      resize();
      camera.updateMatrixWorld();
    };
    if (modeRef.current !== "standard") applyModeRef.current(modeRef.current);

    const drawStatus = (time: number) => {
      const ctx = statusDrawing.context;
      ctx.clearRect(0, 0, statusDrawing.canvas.width, statusDrawing.canvas.height);
      ctx.fillStyle = "#07131a";
      ctx.fillRect(0, 0, statusDrawing.canvas.width, statusDrawing.canvas.height);
      ctx.strokeStyle = "#67d7b2";
      ctx.lineWidth = 4;
      ctx.strokeRect(3, 3, statusDrawing.canvas.width - 6, statusDrawing.canvas.height - 6);
      const active = contactRef.current.filter((item) => item.status === "TRACK").length;
      const gaps = contactRef.current.filter((item) => item.status === "UNOBSERVED").length;
      ctx.fillStyle = "#cfe8df";
      ctx.font = "bold 28px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`SPECTRA / ${runningRef.current ? "RUNNING" : "PAUSED"} · TRACK ${active} · GAP ${gaps} · T+${timeLabel(time)}`, statusDrawing.canvas.width / 2, statusDrawing.canvas.height / 2, statusDrawing.canvas.width - 22);
      statusDrawing.texture.needsUpdate = true;
    };
    let lastStatusSecond = -1;
    const refreshContactCache = () => {
      contactById.clear();
      contactRef.current.forEach((contact) => { contactById.set(contact.id, contact); });
    };
    refreshContactsRef.current = refreshContactCache;
    refreshContactCache();

    const scratchPosition = new THREE.Vector3();
    const animate = () => {
      if (disposed) return;
      const mode = modeRef.current;
      contactMeshes.forEach((group, id) => {
        const contact = contactById.get(id);
        const status = contact?.status;
        const hasPosition = typeof contact?.x === "number" && typeof contact?.y === "number";
        group.visible = hasPosition;
        if (hasPosition && contact) group.position.set((contact.x! - .5) * 100, (contact.altitude ?? 80) / 15, (contact.y! - .5) * 80);
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
      if (mode === "cardboard") {
        const second = Math.floor(elapsedRef.current);
        if (second !== lastStatusSecond) { drawStatus(elapsedRef.current); lastStatusSecond = second; }
        raycaster.setFromCamera(center, camera);
        const hit = raycaster.intersectObjects(gazePickables, false)[0]?.object ?? null;
        if (hit !== gazeTargetRef.current) {
          gazeTargetRef.current = hit;
          gazeStartRef.current = hit ? performance.now() : 0;
          gazeFiredRef.current = false;
        }
        hudButtons.forEach((button) => {
          const material = button.material as THREE.MeshBasicMaterial;
          material.color.set(button === hit ? 0x9bffe0 : 0xffffff);
        });
        gazeReticleMaterial.color.set(hit ? 0xffd483 : 0x9be9ce);
        const dwell = hit && gazeStartRef.current ? Math.min(1, (performance.now() - gazeStartRef.current) / 1100) : 0;
        gazeReticle.scale.setScalar(1 + dwell * .8);
        if (hit && !gazeFiredRef.current && performance.now() - gazeStartRef.current >= 1100) {
          gazeFiredRef.current = true;
          const spec = buttonSpecs.get(hit);
          if (spec) {
            reportAction(spec, "gaze");
          } else {
            const contactId = hit.parent?.userData.contactId;
            if (typeof contactId === "string") {
              callbackRef.current(contactId);
              actionRef.current("OBSERVE", confidenceRef.current, "gaze", undefined, contactId);
            }
          }
        }
      }
      if (mode === "cardboard") {
        eyeCamera.update(camera);
        renderer.setScissorTest(true);
        renderer.setViewport(0, 0, Math.floor(width / 2), height);
        renderer.setScissor(0, 0, Math.floor(width / 2), height);
        renderer.render(scene, eyeCamera.cameraL);
        renderer.setViewport(Math.floor(width / 2), 0, Math.ceil(width / 2), height);
        renderer.setScissor(Math.floor(width / 2), 0, Math.ceil(width / 2), height);
        renderer.render(scene, eyeCamera.cameraR);
      } else {
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, width, height);
        renderer.render(scene, camera);
      }
    };
    renderer.setAnimationLoop(animate);

    return () => {
      disposed = true;
      renderer.setAnimationLoop(null);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointer);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            if (material instanceof THREE.MeshBasicMaterial && material.map) material.map.dispose();
            material.dispose();
          });
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
      cameraRef.current = null;
      rendererRef.current = null;
      resizeRef.current = null;
      applyModeRef.current = null;
      refreshContactsRef.current = null;
      recenterHudRef.current = null;
    };
  }, [config.environment, config.lighting, config.visibility, contactKey, reportAction]);

  const fire = (spec: HudButtonSpec, event: React.PointerEvent<HTMLButtonElement>) => {
    const input: InputMethod = event.pointerType === "touch" ? "touch" : "mouse";
    reportAction(spec, input);
  };
  const confidenceSpec = (level: ConfidenceLevel): HudButtonSpec => ({ label: level, action: "SET_CONFIDENCE", confidence: level });
  const classificationSpec = (classification: ContactClassification, label: string): HudButtonSpec => ({ label, action: "CLASSIFY", classification });

  return (
    <div className={`twin-stage ${viewMode === "standard" ? "" : `immersive-stage immersive-${viewMode}`}`}>
      <div className="twin-badge"><span className="live-dot" /> {viewMode === "standard" ? "OBSERVATION-BASED VIEW" : viewMode === "phone" ? "PHONE MOTION VIEW" : "CARDBOARD STEREO"} <span className="separator">/</span> {viewMode === "standard" ? "LAST KNOWN POSITIONS" : "SYNTHETIC DATA ONLY"}</div>
      {viewMode !== "cardboard" && (
        <div className="view-mode-controls" aria-label="3D viewing mode">
          <button className={viewMode === "standard" ? "active" : ""} onClick={() => void activateMode("standard")}>3D</button>
          <button className={viewMode === "phone" ? "active" : ""} onClick={() => void activateMode("phone")}>PHONE VR</button>
          <button onClick={() => void activateMode("cardboard")}>CARDBOARD</button>
        </div>
      )}
      <div className="twin-overlay top-right"><span>ENV</span><strong>{config.environment.toUpperCase()}</strong><span>LIGHT</span><strong>{config.lighting.toUpperCase()}</strong></div>
      {viewMode === "standard" && <div className="twin-overlay bottom-left"><span>SENSOR VIEW</span><strong>{contacts.filter((contact) => typeof contact.x === "number" && typeof contact.y === "number").length} LOCATED CONTACTS</strong></div>}
      {viewMode === "phone" && (
        <div className="phone-vr-hud">
          <div className="phone-hud-heading">
            <div><span>SPECTRA · PHONE MOTION</span><strong>T+{timeLabel(elapsedSeconds)}</strong></div>
            <div className="phone-hud-run-controls">
              <button onPointerUp={(event) => toggleSimulationRef.current(event.pointerType === "touch" ? "touch" : "mouse")}>{isRunning ? "PAUSE" : elapsedSeconds > 0 ? "RESUME" : "START"}</button>
              <button onPointerUp={(event) => fire({ label: "EXIT", exit: true }, event)}>EXIT</button>
            </div>
          </div>
          <div className="phone-hud-sensors">
            <span><i className="hud-status-track" /> TRACK {contacts.filter((contact) => contact.status === "TRACK").length}</span>
            <span><i className="hud-status-gap" /> GAP {contacts.filter((contact) => contact.status === "UNOBSERVED").length}</span>
            <span>CONTACT {selectedId ?? "—"}</span>
          </div>
          <div className="phone-hud-confidence">
            <span>CONFIDENCE</span>
            {(["LOW", "MEDIUM", "HIGH"] as ConfidenceLevel[]).map((level) => (
              <button key={level} className={confidence === level ? "active" : ""} onPointerUp={(event) => fire(confidenceSpec(level), event)}>{level}</button>
            ))}
          </div>
          <div className="phone-hud-actions">
            {[
              { label: "OBSERVE", action: "OBSERVE" as const },
              { label: "MORE INFO", action: "REQUEST_MORE_INFO" as const },
              { label: "REPORT", action: "REPORT" as const },
              { label: "ESCALATE", action: "ESCALATE" as const },
              { label: "AUTHORISE", action: "AUTHORIZE_RESPONSE" as const },
              { label: "DEFER", action: "DEFER" as const },
            ].map((spec) => <button key={spec.action} onPointerUp={(event) => fire(spec, event)}>{spec.label}</button>)}
          </div>
          <div className="phone-hud-classify">
            {[
              classificationSpec("POSSIBLE_DRONE", "POSSIBLE DRONE"),
              classificationSpec("NON_DRONE", "NON-DRONE"),
              classificationSpec("UNKNOWN", "UNKNOWN"),
            ].map((spec) => <button key={spec.classification} onPointerUp={(event) => fire(spec, event)}>{spec.label}</button>)}
          </div>
          <div className="phone-hud-help">{motionMessage} · input actions are recorded for review</div>
        </div>
      )}
      {viewMode === "cardboard" && <div className="cardboard-gaze-tip"><span className="gaze-reticle" /> Look at a 3D button and hold for 1.1 seconds to select it. Remove the phone from the viewer and return to Phone VR to exit if needed.</div>}
      {contacts.every((contact) => typeof contact.x !== "number" || typeof contact.y !== "number") && (
        <div className="twin-empty-state">
          <span>{elapsedSeconds > 0 ? "SYNTHETIC SENSOR SWEEP" : "SIMULATION STANDBY"}</span>
          <strong>No contact positions acquired</strong>
          <p>{elapsedSeconds > 0 ? "The synthetic sensor has not provided a usable position yet." : "Start the exercise to generate observations and populate the environment with contact markers."}</p>
        </div>
      )}
      <div ref={hostRef} className="three-host" />
    </div>
  );
}
