import * as THREE from "three";
import "./styles.css";

type WeaponId = "ak47" | "glock17" | "glock18" | "soaker" | "marauder";

type Weapon = {
  id: WeaponId;
  name: string;
  ammo: number;
  magSize: number;
  reserve: number;
  fireRate: number;
  damage: number;
  spread: number;
  recoil: number;
  automatic: boolean;
  pellets: number;
  projectileSpeed?: number;
  color: number;
  reloadMs: number;
  aimFov: number;
};

type Target = {
  mesh: THREE.Group;
  health: number;
  maxHealth: number;
  radius: number;
  velocity: THREE.Vector3;
  respawnAt: number;
};

type Collider = {
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
  disabled?: boolean;
};

type Door = {
  meshes: THREE.Mesh[];
  collider: Collider;
  center: THREE.Vector3;
  open: boolean;
  closed: Array<{ position: THREE.Vector3; rotation: THREE.Euler }>;
  opened: Array<{ position: THREE.Vector3; rotation: THREE.Euler }>;
};

type RemotePlayer = {
  mesh: THREE.Group;
  name: string;
  lastSeen: number;
  targetPosition: THREE.Vector3;
  targetYaw: number;
};

type MultiplayerMessage =
  | {
      type: "presence";
      id: string;
      name: string;
      x: number;
      y: number;
      z: number;
      yaw: number;
      weapon: string;
    }
  | { type: "chat"; id: string; name: string; text: string; sentAt: number }
  | { type: "leave"; id: string };

const WALK_SPEED = 8.6;
const CITY_HALF_SIZE = (WALK_SPEED * 60 * 60 * 4) / 2;
const PLAYER_RADIUS = 0.55;

const weaponBlueprints: Record<WeaponId, Weapon> = {
  ak47: {
    id: "ak47",
    name: "AK-47",
    ammo: 30,
    magSize: 30,
    reserve: 120,
    fireRate: 105,
    damage: 36,
    spread: 0.014,
    recoil: 0.013,
    automatic: true,
    pellets: 1,
    color: 0x2f241a,
    reloadMs: 1600,
    aimFov: 50,
  },
  glock17: {
    id: "glock17",
    name: "Glock 17",
    ammo: 17,
    magSize: 17,
    reserve: 68,
    fireRate: 160,
    damage: 24,
    spread: 0.01,
    recoil: 0.008,
    automatic: false,
    pellets: 1,
    color: 0x151515,
    reloadMs: 1100,
    aimFov: 48,
  },
  glock18: {
    id: "glock18",
    name: "Glock 18",
    ammo: 33,
    magSize: 33,
    reserve: 99,
    fireRate: 72,
    damage: 18,
    spread: 0.018,
    recoil: 0.0095,
    automatic: true,
    pellets: 1,
    color: 0x101010,
    reloadMs: 1250,
    aimFov: 50,
  },
  soaker: {
    id: "soaker",
    name: "Super Soaker",
    ammo: 50,
    magSize: 50,
    reserve: 150,
    fireRate: 82,
    damage: 9,
    spread: 0.026,
    recoil: 0.002,
    automatic: true,
    pellets: 3,
    projectileSpeed: 34,
    color: 0x18a7ff,
    reloadMs: 1900,
    aimFov: 56,
  },
  marauder: {
    id: "marauder",
    name: "Benjamin Marauder",
    ammo: 10,
    magSize: 10,
    reserve: 50,
    fireRate: 720,
    damage: 62,
    spread: 0.0035,
    recoil: 0.004,
    automatic: false,
    pellets: 1,
    color: 0x1f1d1a,
    reloadMs: 2100,
    aimFov: 28,
  },
};

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing #app root");

app.innerHTML = `
  <canvas id="game"></canvas>
  <div class="shade"></div>
  <button class="start" id="start">
    <span>Click to deploy</span>
    <small>WASD move · Mouse aim · Click fire · E aim · O doors · R reload · 1-5 swap</small>
  </button>
  <div class="hud">
    <div class="stat"><b id="weapon">AK-47</b><span id="ammo">30 / 120</span></div>
    <div class="stat"><b id="score">0</b><span>score</span></div>
    <div class="stat"><b id="streak">0</b><span>streak</span></div>
  </div>
  <div class="reticle"><i></i><i></i><i></i><i></i></div>
  <div class="scope" id="scope"><i></i><b></b><em></em></div>
  <div class="weapons" id="weapons"></div>
  <div class="feed" id="feed"></div>
  <section class="chat" id="chat">
    <div class="chat-log" id="chat-log"></div>
    <form class="chat-form" id="chat-form">
      <input id="chat-input" maxlength="120" placeholder="Chat to all players" autocomplete="off" />
      <button type="submit">Send</button>
    </form>
  </section>
`;

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9eb8c6);
scene.fog = new THREE.Fog(0x9eb8c6, 30, 135);

const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 230);
const player = new THREE.Object3D();
player.position.set(0, 1.65, 12);
player.add(camera);
scene.add(player);

const sun = new THREE.DirectionalLight(0xfff0d2, 4.5);
sun.position.set(-24, 42, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -70;
sun.shadow.camera.right = 70;
sun.shadow.camera.top = 70;
sun.shadow.camera.bottom = -70;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xc7e7ff, 0x4c3d2f, 1.7));

const floorTexture = makeCanvasTexture("concrete");
floorTexture.wrapS = THREE.RepeatWrapping;
floorTexture.wrapT = THREE.RepeatWrapping;
floorTexture.repeat.set(18, 18);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(CITY_HALF_SIZE * 2, CITY_HALF_SIZE * 2),
  new THREE.MeshStandardMaterial({ map: floorTexture, roughness: 0.82, metalness: 0.03 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const targets: Target[] = [];
const colliders: Collider[] = [];
const doors: Door[] = [];
const keys = new Set<string>();
const raycaster = new THREE.Raycaster();
const clock = new THREE.Clock();
const weaponIds: WeaponId[] = ["ak47", "glock17", "glock18", "soaker", "marauder"];
const weapons = weaponIds.map((id) => ({ ...weaponBlueprints[id] }));
let currentWeaponIndex = 0;
let lastShot = 0;
let firing = false;
let reloadUntil = 0;
let yaw = 0;
let pitch = 0;
let score = 0;
let streak = 0;
let bob = 0;
let hitFlash = 0;
let controlsActive = false;
let aimProgress = 0;
let aiming = false;
const playerId =
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `player-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const playerName = `Player ${playerId.slice(0, 4).toUpperCase()}`;
const remotePlayers = new Map<string, RemotePlayer>();
const multiplayerChannel = "BroadcastChannel" in window ? new BroadcastChannel("la-fps-multiplayer") : undefined;
let lastPresenceSent = 0;

const gunRoot = new THREE.Group();
camera.add(gunRoot);
buildWeaponModel();

const projectileGroup = new THREE.Group();
scene.add(projectileGroup);
const projectiles: Array<{ mesh: THREE.Mesh; velocity: THREE.Vector3; damage: number; born: number }> = [];

makeArena();
spawnTargets();
renderWeaponBar();
updateHud();
setupMultiplayer();
resize();

window.addEventListener("resize", resize);
window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement) return;
  if (event.code === "Enter") {
    focusChat();
    return;
  }
  keys.add(event.code);
  const numeric = Number(event.key);
  if (numeric >= 1 && numeric <= 5) switchWeapon(numeric - 1);
  if (event.code === "KeyE" && !event.repeat) aiming = !aiming;
  if (event.code === "KeyO" && !event.repeat) toggleNearestDoor();
  if (event.code === "KeyR") reload();
});
window.addEventListener("keyup", (event) => {
  if (event.target instanceof HTMLInputElement) return;
  keys.delete(event.code);
});
canvas.addEventListener("mousedown", () => {
  if (!controlsActive) return;
  firing = true;
  shoot();
});
canvas.addEventListener("mouseup", () => {
  firing = false;
});
window.addEventListener("mousemove", (event) => {
  if (!controlsActive && document.pointerLockElement !== canvas) return;
  const sensitivity = THREE.MathUtils.lerp(1, 0.42, aimProgress);
  yaw -= event.movementX * 0.0022 * sensitivity;
  pitch -= event.movementY * 0.002 * sensitivity;
  pitch = THREE.MathUtils.clamp(pitch, -1.42, 1.35);
});

document.querySelector<HTMLButtonElement>("#start")!.addEventListener("click", async (event) => {
  event.stopPropagation();
  controlsActive = true;
  document.body.classList.add("playing");
  try {
    if (window.top === window) {
      await canvas.requestPointerLock();
    } else {
      addFeed("Pointer lock unavailable");
    }
  } catch {
    addFeed("Pointer lock unavailable");
  }
});

document.addEventListener("pointerlockchange", () => {
  controlsActive = document.pointerLockElement === canvas || document.body.classList.contains("playing");
  document.body.classList.toggle("playing", controlsActive);
});

renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), 0.034);
  const now = performance.now();
  movePlayer(delta);
  updateTargets(delta, now);
  updateProjectiles(delta, now);
  updateAim(delta);
  updateWeapon(delta);
  updateMultiplayer(delta, now);
  if (firing && weapons[currentWeaponIndex].automatic) shoot();
  hitFlash = Math.max(0, hitFlash - delta * 4);
  renderer.render(scene, camera);
});

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function movePlayer(delta: number) {
  player.rotation.y = yaw;
  camera.rotation.x = pitch;
  const forward = Number(keys.has("KeyW")) - Number(keys.has("KeyS"));
  const strafe = Number(keys.has("KeyD")) - Number(keys.has("KeyA"));
  const sprint = keys.has("ShiftLeft") ? 1.45 : 1;
  const speed = WALK_SPEED * sprint;
  const direction = new THREE.Vector3(strafe, 0, -forward);
  if (direction.lengthSq() > 0) {
    direction.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const desired = player.position.clone().addScaledVector(direction, speed * delta);
    desired.x = THREE.MathUtils.clamp(desired.x, -CITY_HALF_SIZE, CITY_HALF_SIZE);
    desired.z = THREE.MathUtils.clamp(desired.z, -CITY_HALF_SIZE, CITY_HALF_SIZE);
    moveWithCollisions(desired);
    bob += delta * speed;
  }
  player.position.y = 1.65 + Math.sin(bob * 2.2) * 0.025;
}

function moveWithCollisions(desired: THREE.Vector3) {
  const nextX = player.position.clone();
  nextX.x = desired.x;
  if (!hitsSolid(nextX.x, nextX.z)) player.position.x = nextX.x;

  const nextZ = player.position.clone();
  nextZ.z = desired.z;
  if (!hitsSolid(nextZ.x, nextZ.z)) player.position.z = nextZ.z;
}

function hitsSolid(x: number, z: number) {
  return colliders.some(
    (collider) =>
      !collider.disabled &&
      x > collider.x - collider.halfX - PLAYER_RADIUS &&
      x < collider.x + collider.halfX + PLAYER_RADIUS &&
      z > collider.z - collider.halfZ - PLAYER_RADIUS &&
      z < collider.z + collider.halfZ + PLAYER_RADIUS
  );
}

function toggleNearestDoor() {
  let nearest: Door | undefined;
  let nearestDistance = Infinity;
  for (const door of doors) {
    const distance = door.center.distanceTo(player.position);
    if (distance < nearestDistance) {
      nearest = door;
      nearestDistance = distance;
    }
  }
  if (!nearest || nearestDistance > 5.2) {
    addFeed("No door nearby");
    return;
  }
  nearest.open = !nearest.open;
  nearest.collider.disabled = nearest.open;
  const targetTransforms = nearest.open ? nearest.opened : nearest.closed;
  nearest.meshes.forEach((mesh, index) => {
    mesh.position.copy(targetTransforms[index].position);
    mesh.rotation.copy(targetTransforms[index].rotation);
  });
  addFeed(nearest.open ? "Door opened" : "Door closed");
}

function setupMultiplayer() {
  const form = document.querySelector<HTMLFormElement>("#chat-form")!;
  const input = document.querySelector<HTMLInputElement>("#chat-input")!;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    const message: MultiplayerMessage = { type: "chat", id: playerId, name: playerName, text, sentAt: Date.now() };
    handleMultiplayerMessage(message);
    multiplayerChannel?.postMessage(message);
    input.value = "";
    input.blur();
    canvas.focus();
  });

  multiplayerChannel?.addEventListener("message", (event: MessageEvent<MultiplayerMessage>) => {
    handleMultiplayerMessage(event.data);
  });

  window.addEventListener("beforeunload", () => {
    multiplayerChannel?.postMessage({ type: "leave", id: playerId } satisfies MultiplayerMessage);
  });

  addChatLine("System", "Open another tab to see other players and shared chat.");
}

function focusChat() {
  const input = document.querySelector<HTMLInputElement>("#chat-input")!;
  input.focus();
}

function handleMultiplayerMessage(message: MultiplayerMessage) {
  if (message.id === playerId) {
    if (message.type === "chat") addChatLine(message.name, message.text);
    return;
  }

  if (message.type === "presence") {
    const remote = getRemotePlayer(message.id, message.name);
    remote.name = message.name;
    remote.lastSeen = performance.now();
    remote.targetPosition.set(message.x, message.y, message.z);
    remote.targetYaw = message.yaw;
    return;
  }

  if (message.type === "chat") {
    addChatLine(message.name, message.text);
    return;
  }

  if (message.type === "leave") removeRemotePlayer(message.id);
}

function updateMultiplayer(delta: number, now: number) {
  if (multiplayerChannel && now - lastPresenceSent > 90) {
    lastPresenceSent = now;
    multiplayerChannel.postMessage({
      type: "presence",
      id: playerId,
      name: playerName,
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
      yaw,
      weapon: weapons[currentWeaponIndex].name,
    } satisfies MultiplayerMessage);
  }

  for (const [id, remote] of remotePlayers) {
    remote.mesh.position.lerp(remote.targetPosition, Math.min(1, delta * 12));
    remote.mesh.rotation.y = THREE.MathUtils.lerp(remote.mesh.rotation.y, remote.targetYaw, Math.min(1, delta * 10));
    if (now - remote.lastSeen > 5000) removeRemotePlayer(id);
  }
}

function getRemotePlayer(id: string, name: string) {
  const existing = remotePlayers.get(id);
  if (existing) return existing;
  const mesh = makeRemotePlayerMesh(name);
  scene.add(mesh);
  const remote: RemotePlayer = {
    mesh,
    name,
    lastSeen: performance.now(),
    targetPosition: new THREE.Vector3(),
    targetYaw: 0,
  };
  remotePlayers.set(id, remote);
  addFeed(`${name} joined`);
  return remote;
}

function removeRemotePlayer(id: string) {
  const remote = remotePlayers.get(id);
  if (!remote) return;
  scene.remove(remote.mesh);
  remotePlayers.delete(id);
}

function makeRemotePlayerMesh(name: string) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x386fc2, roughness: 0.58 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xd7a37a, roughness: 0.52 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x111315, roughness: 0.45 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 1.0, 8, 16), bodyMat);
  body.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), headMat);
  head.position.y = 1.86;
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.75), darkMat);
  gun.position.set(0.34, 1.22, -0.35);
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 0.45),
    new THREE.MeshBasicMaterial({ map: makeTextTexture(name, "#ffffff", "rgba(0,0,0,.45)"), transparent: true, side: THREE.DoubleSide })
  );
  label.position.y = 2.35;
  group.add(body, head, gun, label);
  group.traverse((child) => {
    child.castShadow = true;
  });
  return group;
}

function addChatLine(name: string, text: string) {
  const log = document.querySelector<HTMLDivElement>("#chat-log")!;
  const line = document.createElement("div");
  line.innerHTML = `<b>${escapeHtml(name)}</b><span>${escapeHtml(text)}</span>`;
  log.append(line);
  while (log.children.length > 8) log.firstElementChild?.remove();
  log.scrollTop = log.scrollHeight;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[char];
  });
}

function shoot() {
  const weapon = weapons[currentWeaponIndex];
  const now = performance.now();
  if (now < reloadUntil || now - lastShot < weapon.fireRate) return;
  if (weapon.ammo <= 0) {
    reload();
    return;
  }
  lastShot = now;
  weapon.ammo--;
  pitch += weapon.recoil * (1 - aimProgress * 0.45);
  gunRoot.position.z = 0.08;
  gunRoot.rotation.x = -0.08;
  muzzleFlash(weapon.color);
  for (let i = 0; i < weapon.pellets; i++) fireRound(weapon);
  updateHud();
}

function fireRound(weapon: Weapon) {
  const direction = new THREE.Vector3(0, 0, -1);
  const spread = weapon.spread * (1 - aimProgress * 0.72);
  direction.x += (Math.random() - 0.5) * spread;
  direction.y += (Math.random() - 0.5) * spread;
  direction.normalize().applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()));
  if (weapon.projectileSpeed) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x65d8ff })
    );
    mesh.position.copy(camera.getWorldPosition(new THREE.Vector3())).addScaledVector(direction, 0.8);
    projectileGroup.add(mesh);
    projectiles.push({ mesh, velocity: direction.multiplyScalar(weapon.projectileSpeed), damage: weapon.damage, born: performance.now() });
    return;
  }
  raycaster.set(camera.getWorldPosition(new THREE.Vector3()), direction);
  raycaster.far = 140;
  const hits = raycaster.intersectObjects(targets.map((target) => target.mesh), true);
  const hit = hits.find((result) => result.object.userData.targetIndex !== undefined);
  if (hit) damageTarget(targets[hit.object.userData.targetIndex], weapon.damage);
  tracer(direction, weapon.color);
}

function updateProjectiles(delta: number, now: number) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const projectile = projectiles[i];
    projectile.mesh.position.addScaledVector(projectile.velocity, delta);
    let consumed = now - projectile.born > 2500;
    for (const target of targets) {
      if (target.health > 0 && projectile.mesh.position.distanceTo(target.mesh.position) < target.radius + 0.15) {
        damageTarget(target, projectile.damage);
        consumed = true;
        break;
      }
    }
    if (consumed) {
      projectileGroup.remove(projectile.mesh);
      projectiles.splice(i, 1);
    }
  }
}

function damageTarget(target: Target, damage: number) {
  if (target.health <= 0) return;
  target.health -= damage;
  hitFlash = 1;
  target.mesh.scale.setScalar(1.08);
  if (target.health <= 0) {
    score += 100 + streak * 15;
    streak++;
    target.respawnAt = performance.now() + 900;
    target.mesh.visible = false;
    addFeed("+ target down");
  }
  updateHud();
}

function updateTargets(delta: number, now: number) {
  targets.forEach((target, index) => {
    if (target.health <= 0) {
      if (now > target.respawnAt) resetTarget(target, index);
      return;
    }
    target.mesh.position.addScaledVector(target.velocity, delta);
    if (Math.abs(target.mesh.position.x) > 48) target.velocity.x *= -1;
    if (Math.abs(target.mesh.position.z) > 42) target.velocity.z *= -1;
    target.mesh.rotation.y += delta * 0.45;
    target.mesh.scale.lerp(new THREE.Vector3(1, 1, 1), delta * 10);
  });
}

function reload() {
  const weapon = weapons[currentWeaponIndex];
  if (performance.now() < reloadUntil || weapon.ammo === weapon.magSize || weapon.reserve <= 0) return;
  reloadUntil = performance.now() + weapon.reloadMs;
  addFeed(`Reloading ${weapon.name}`);
  setTimeout(() => {
    const needed = weapon.magSize - weapon.ammo;
    const moved = Math.min(needed, weapon.reserve);
    weapon.ammo += moved;
    weapon.reserve -= moved;
    updateHud();
  }, weapon.reloadMs);
}

function switchWeapon(index: number) {
  if (!weapons[index]) return;
  currentWeaponIndex = index;
  reloadUntil = 0;
  aiming = false;
  aimProgress = 0;
  buildWeaponModel();
  renderWeaponBar();
  updateHud();
}

function updateAim(delta: number) {
  const weapon = weapons[currentWeaponIndex];
  const target = aiming ? 1 : 0;
  aimProgress = THREE.MathUtils.damp(aimProgress, target, 13, delta);
  camera.fov = THREE.MathUtils.lerp(72, weapon.aimFov, aimProgress);
  camera.updateProjectionMatrix();
  document.body.classList.toggle("aiming", aimProgress > 0.12);
  document.body.classList.toggle("scoped", weapon.id === "marauder" && aimProgress > 0.72);
}

function updateWeapon(delta: number) {
  const view = getWeaponView(aimProgress);
  gunRoot.position.lerp(view.position, delta * 12);
  gunRoot.rotation.x = THREE.MathUtils.lerp(gunRoot.rotation.x, 0, delta * 11);
  gunRoot.rotation.y = THREE.MathUtils.lerp(gunRoot.rotation.y, view.rotationY, delta * 11);
  gunRoot.rotation.z = Math.sin(bob * 2) * 0.01;
  gunRoot.visible = true;
}

function buildWeaponModel() {
  gunRoot.clear();
  const weapon = weapons[currentWeaponIndex];
  const view = getWeaponView(aimProgress);
  gunRoot.position.copy(view.position);
  gunRoot.rotation.y = view.rotationY;
  gunRoot.scale.setScalar(view.scale);
  if (weapon.id === "ak47") buildAk47Model();
  if (weapon.id === "glock17") buildGlockModel(false);
  if (weapon.id === "glock18") buildGlockModel(true);
  if (weapon.id === "soaker") buildSuperSoakerModel();
  if (weapon.id === "marauder") buildMarauderModel();
  prepareViewModel();
}

function prepareViewModel() {
  gunRoot.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.renderOrder = 20;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      material.depthTest = false;
      material.needsUpdate = true;
    }
  });
}

function getWeaponView(aim: number) {
  const weapon = weapons[currentWeaponIndex];
  const presets = {
    ak47: {
      hip: new THREE.Vector3(0.48, -0.38, -0.72),
      aim: new THREE.Vector3(0, -0.31, -0.9),
      hipScale: 0.72,
      aimScale: 0.68,
      hipY: 0.08,
      aimY: 0,
    },
    glock17: {
      hip: new THREE.Vector3(0.16, -0.4, -0.88),
      aim: new THREE.Vector3(0, -0.34, -0.78),
      hipScale: 0.78,
      aimScale: 0.82,
      hipY: 0.28,
      aimY: 0,
    },
    glock18: {
      hip: new THREE.Vector3(0.16, -0.4, -0.88),
      aim: new THREE.Vector3(0, -0.35, -0.78),
      hipScale: 0.78,
      aimScale: 0.82,
      hipY: 0.28,
      aimY: 0,
    },
    soaker: {
      hip: new THREE.Vector3(0.44, -0.36, -0.68),
      aim: new THREE.Vector3(0.02, -0.28, -0.82),
      hipScale: 0.84,
      aimScale: 0.8,
      hipY: 0.16,
      aimY: 0.02,
    },
    marauder: {
      hip: new THREE.Vector3(0.45, -0.37, -0.78),
      aim: new THREE.Vector3(0, -0.24, -0.7),
      hipScale: 0.66,
      aimScale: 0.82,
      hipY: 0.12,
      aimY: 0,
    },
  } satisfies Record<WeaponId, { hip: THREE.Vector3; aim: THREE.Vector3; hipScale: number; aimScale: number; hipY: number; aimY: number }>;
  const preset = presets[weapon.id];
  return {
    position: preset.hip.clone().lerp(preset.aim, aim),
    scale: THREE.MathUtils.lerp(preset.hipScale, preset.aimScale, aim),
    rotationY: THREE.MathUtils.lerp(preset.hipY, preset.aimY, aim),
  };
}

function buildAk47Model() {
  const steel = new THREE.MeshStandardMaterial({ color: 0x171614, metalness: 0.78, roughness: 0.31 });
  const wornSteel = new THREE.MeshStandardMaterial({ color: 0x2a2825, metalness: 0.7, roughness: 0.43 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a5128, metalness: 0.02, roughness: 0.58 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x5b331d, metalness: 0.02, roughness: 0.62 });

  const receiver = box(0.42, 0.2, 0.72, steel, 0, 0.02, -0.02);
  const dustCover = box(0.36, 0.09, 0.58, wornSteel, 0, 0.18, -0.04);
  const handguard = box(0.34, 0.2, 0.54, wood, 0, -0.02, -0.56);
  const lowerGuard = box(0.3, 0.12, 0.46, darkWood, 0, -0.16, -0.5);
  const stock = box(0.34, 0.24, 0.68, wood, 0, -0.02, 0.62);
  stock.rotation.x = 0.14;

  const barrel = cylinder(0.035, 0.86, steel, 0, 0.11, -1.12, Math.PI / 2, 0, 0);
  const gasTube = cylinder(0.032, 0.58, wornSteel, 0, 0.25, -0.83, Math.PI / 2, 0, 0);
  const muzzle = cylinder(0.052, 0.18, steel, 0, 0.1, -1.62, Math.PI / 2, 0, 0);
  muzzle.rotation.z = 0.25;

  const frontSight = box(0.18, 0.25, 0.07, steel, 0, 0.28, -1.42);
  const rearSight = box(0.24, 0.08, 0.12, steel, 0, 0.28, -0.23);
  const grip = box(0.16, 0.42, 0.22, darkWood, 0.03, -0.3, 0.2);
  grip.rotation.x = -0.24;

  const magTop = box(0.22, 0.28, 0.22, steel, 0, -0.26, -0.12);
  const magBottom = box(0.25, 0.46, 0.24, steel, 0, -0.54, -0.02);
  magTop.rotation.x = 0.14;
  magBottom.rotation.x = -0.2;

  gunRoot.add(receiver, dustCover, handguard, lowerGuard, stock, barrel, gasTube, muzzle, frontSight, rearSight, grip, magTop, magBottom);
}

function buildGlockModel(isGlock18: boolean) {
  const slide = new THREE.MeshStandardMaterial({ color: 0x24272a, metalness: 0.62, roughness: 0.24 });
  const polymer = new THREE.MeshStandardMaterial({ color: 0x070808, metalness: 0.12, roughness: 0.5 });
  const detail = new THREE.MeshStandardMaterial({ color: 0x2b2d2f, metalness: 0.5, roughness: 0.34 });

  const upper = box(0.36, 0.18, 0.72, slide, 0, 0.1, -0.12);
  const frame = box(0.32, 0.16, 0.54, polymer, 0, -0.04, -0.03);
  const barrel = cylinder(0.038, 0.25, detail, 0, 0.1, -0.58, Math.PI / 2, 0, 0);
  const muzzleFace = box(0.2, 0.12, 0.035, detail, 0, 0.1, -0.51);
  const rearSerrations = box(0.38, 0.19, 0.03, detail, 0, 0.1, 0.19);
  const frontSight = box(0.06, 0.04, 0.04, detail, 0, 0.22, -0.42);
  const rearSight = box(0.17, 0.04, 0.05, detail, 0, 0.22, 0.2);
  const triggerGuard = cylinder(0.06, 0.28, polymer, 0, -0.17, -0.12, 0, 0, Math.PI / 2);
  triggerGuard.scale.set(1, 0.55, 1);
  const trigger = box(0.035, 0.18, 0.055, detail, 0, -0.17, -0.14);
  trigger.rotation.x = -0.28;
  const grip = box(0.2, isGlock18 ? 0.5 : 0.38, 0.22, polymer, 0.02, isGlock18 ? -0.36 : -0.3, 0.18);
  grip.rotation.x = -0.18;
  const magBase = box(0.24, 0.05, 0.25, detail, 0.03, isGlock18 ? -0.62 : -0.51, 0.24);

  gunRoot.add(upper, frame, barrel, muzzleFace, rearSerrations, frontSight, rearSight, triggerGuard, trigger, grip, magBase);

  if (isGlock18) {
    gunRoot.add(
      box(0.22, 0.08, 0.08, detail, 0.19, 0.07, 0.08),
      box(0.3, 0.04, 0.08, detail, 0, 0.22, -0.18),
      box(0.3, 0.04, 0.08, detail, 0, 0.22, -0.3)
    );
  } else {
    gunRoot.add(box(0.18, 0.035, 0.11, detail, 0, 0.2, -0.18));
  }
}

function buildSuperSoakerModel() {
  const blue = new THREE.MeshStandardMaterial({ color: 0x19aee8, metalness: 0.02, roughness: 0.24 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xff8b1a, metalness: 0.02, roughness: 0.33 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xffd33d, metalness: 0.01, roughness: 0.36 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf4fbff, metalness: 0.01, roughness: 0.28 });

  const tank = cylinder(0.18, 0.62, blue, 0, 0.05, 0.06, Math.PI / 2, 0, 0);
  tank.scale.y = 0.82;
  const body = box(0.42, 0.24, 0.66, yellow, 0, -0.02, -0.18);
  const pump = cylinder(0.065, 0.82, orange, 0, 0.08, -0.72, Math.PI / 2, 0, 0);
  const barrel = cylinder(0.06, 0.72, blue, 0, 0.13, -0.8, Math.PI / 2, 0, 0);
  const nozzle = cylinder(0.095, 0.16, orange, 0, 0.13, -1.18, Math.PI / 2, 0, 0);
  const grip = box(0.18, 0.38, 0.2, blue, 0.03, -0.3, 0.1);
  grip.rotation.x = -0.24;
  const triggerGuard = cylinder(0.055, 0.27, orange, 0, -0.16, -0.08, 0, 0, Math.PI / 2);
  triggerGuard.scale.set(1, 0.58, 1);
  const fillCap = cylinder(0.07, 0.08, white, 0, 0.25, 0.08, 0, 0, 0);

  gunRoot.add(tank, body, pump, barrel, nozzle, grip, triggerGuard, fillCap);
}

function buildMarauderModel() {
  const black = new THREE.MeshStandardMaterial({ color: 0x10100f, metalness: 0.48, roughness: 0.36 });
  const scopeMat = new THREE.MeshStandardMaterial({ color: 0x070808, metalness: 0.58, roughness: 0.28, side: THREE.DoubleSide });
  const parkerized = new THREE.MeshStandardMaterial({ color: 0x2a2c2b, metalness: 0.52, roughness: 0.42 });
  const walnut = new THREE.MeshStandardMaterial({ color: 0x70431f, metalness: 0.02, roughness: 0.62 });
  const darkWalnut = new THREE.MeshStandardMaterial({ color: 0x3c2417, metalness: 0.02, roughness: 0.66 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x6fa4ad,
    metalness: 0.02,
    roughness: 0.02,
    emissive: 0x19383e,
    emissiveIntensity: 0.38,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  });

  const stock = box(0.38, 0.26, 0.82, walnut, 0, -0.09, 0.45);
  stock.rotation.x = 0.1;
  const cheekPiece = box(0.34, 0.1, 0.38, darkWalnut, 0, 0.09, 0.42);
  const forearm = box(0.32, 0.22, 0.7, walnut, 0, -0.13, -0.45);
  const grip = box(0.18, 0.42, 0.22, darkWalnut, 0.02, -0.34, 0.1);
  grip.rotation.x = -0.3;
  const receiver = box(0.32, 0.16, 0.44, parkerized, 0, 0.08, -0.08);
  const shroud = cylinder(0.065, 1.22, black, 0, 0.12, -0.9, Math.PI / 2, 0, 0);
  const airTube = cylinder(0.08, 1.02, parkerized, 0, -0.06, -0.82, Math.PI / 2, 0, 0);
  const fillCap = cylinder(0.085, 0.08, black, 0, -0.06, -1.34, Math.PI / 2, 0, 0);
  const magazine = cylinder(0.13, 0.075, black, 0, 0.21, -0.12, Math.PI / 2, 0, 0);
  const bolt = cylinder(0.025, 0.28, black, 0.22, 0.14, 0.02, 0, 0, Math.PI / 2);
  const boltKnob = cylinder(0.045, 0.06, black, 0.36, 0.14, 0.02, 0, 0, Math.PI / 2);

  const scopeTube = openCylinder(0.07, 0.78, scopeMat, 0, 0.36, -0.18, Math.PI / 2, 0, 0);
  const frontBell = openCylinder(0.12, 0.16, scopeMat, 0, 0.36, -0.58, Math.PI / 2, 0, 0);
  const rearBell = openCylinder(0.12, 0.16, scopeMat, 0, 0.36, 0.22, Math.PI / 2, 0, 0);
  const rearLens = cylinder(0.092, 0.01, glass, 0, 0.36, 0.305, Math.PI / 2, 0, 0);
  const frontLens = cylinder(0.108, 0.01, glass, 0, 0.36, -0.665, Math.PI / 2, 0, 0);
  const frontRing = box(0.08, 0.18, 0.05, black, 0, 0.22, -0.42);
  const rearRing = box(0.08, 0.18, 0.05, black, 0, 0.22, 0.05);
  const turret = cylinder(0.04, 0.1, black, 0, 0.47, -0.18, 0, 0, 0);
  const focusRing = openCylinder(0.125, 0.045, scopeMat, 0, 0.36, 0.32, Math.PI / 2, 0, 0);

  gunRoot.add(
    stock,
    cheekPiece,
    forearm,
    grip,
    receiver,
    shroud,
    airTube,
    fillCap,
    magazine,
    bolt,
    boltKnob,
    scopeTube,
    frontBell,
    rearBell,
    rearLens,
    frontLens,
    frontRing,
    rearRing,
    turret,
    focusRing
  );
}

function box(x: number, y: number, z: number, material: THREE.Material, px: number, py: number, pz: number) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(x, y, z), material);
  mesh.position.set(px, py, pz);
  mesh.castShadow = true;
  return mesh;
}

function cylinder(radius: number, length: number, material: THREE.Material, px: number, py: number, pz: number, rx: number, ry: number, rz: number) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 40), material);
  mesh.position.set(px, py, pz);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  return mesh;
}

function openCylinder(radius: number, length: number, material: THREE.Material, px: number, py: number, pz: number, rx: number, ry: number, rz: number) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 72, 1, true), material);
  mesh.position.set(px, py, pz);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  return mesh;
}

function muzzleFlash(color: number) {
  const flash = new THREE.PointLight(color, 7, 4);
  flash.position.set(0, 0.03, -1.1);
  gunRoot.add(flash);
  setTimeout(() => gunRoot.remove(flash), 42);
}

function tracer(direction: THREE.Vector3, color: number) {
  const start = camera.getWorldPosition(new THREE.Vector3()).addScaledVector(direction, 1.2);
  const end = start.clone().addScaledVector(direction, 34);
  const curve = new THREE.BufferGeometry().setFromPoints([start, end]);
  const line = new THREE.Line(curve, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.62 }));
  scene.add(line);
  setTimeout(() => scene.remove(line), 42);
}

function makeArena() {
  makeLosAngelesBackdrop();
  makeOpenDoorBuildings();
  makeResidentialBlocks();
  makeStreetGrid();
  makePalmRows();
  makeOpenProps();
}

function wall(x: number, y: number, z: number, px: number, py: number, pz: number, material: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(x, y, z), material);
  mesh.position.set(px, py, pz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function solidWall(x: number, y: number, z: number, px: number, py: number, pz: number, material: THREE.Material) {
  const mesh = wall(x, y, z, px, py, pz, material);
  colliders.push({ x: px, z: pz, halfX: x / 2, halfZ: z / 2 });
  return mesh;
}

function makeDoor(meshes: THREE.Mesh[], collider: Collider, opened: Array<{ position: THREE.Vector3; rotation: THREE.Euler }>) {
  colliders.push(collider);
  doors.push({
    meshes,
    collider,
    center: new THREE.Vector3(collider.x, 1.4, collider.z),
    open: false,
    closed: meshes.map((mesh) => ({ position: mesh.position.clone(), rotation: mesh.rotation.clone() })),
    opened,
  });
}

function makeLosAngelesBackdrop() {
  const hazeMat = new THREE.MeshBasicMaterial({ color: 0x8f8170, transparent: true, opacity: 0.72, side: THREE.DoubleSide });
  const hills = new THREE.Mesh(new THREE.PlaneGeometry(150, 28), hazeMat);
  hills.position.set(0, 13, -78);
  scene.add(hills);

  const skylineMat = new THREE.MeshStandardMaterial({ color: 0x3d4244, roughness: 0.62, metalness: 0.06 });
  const windows = new THREE.MeshBasicMaterial({ color: 0xf7d47e, transparent: true, opacity: 0.72 });
  const towerData = [
    [-44, 12, 9], [-34, 18, 7], [-25, 24, 8], [-15, 16, 10], [-5, 29, 9], [6, 21, 7], [17, 15, 11], [29, 23, 8], [40, 13, 9],
  ];
  for (const [x, height, width] of towerData) {
    const tower = wall(width, height, 4, x, height / 2, -66, skylineMat);
    scene.add(tower);
    for (let y = 4; y < height - 2; y += 4) {
      const strip = wall(width * 0.68, 0.32, 4.05, x, y, -63.95, windows);
      scene.add(strip);
    }
  }

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 4),
    new THREE.MeshBasicMaterial({ map: makeTextTexture("HOLLYWOOD", "#f4efe0", "rgba(0,0,0,0)"), transparent: true, side: THREE.DoubleSide })
  );
  sign.position.set(-34, 22, -63);
  sign.rotation.y = 0.08;
  scene.add(sign);
}

function makeOpenDoorBuildings() {
  const stuccoA = new THREE.MeshStandardMaterial({ color: 0xc8b89f, roughness: 0.83 });
  const stuccoB = new THREE.MeshStandardMaterial({ color: 0x9fb4b1, roughness: 0.78 });
  const stuccoC = new THREE.MeshStandardMaterial({ color: 0xb88f74, roughness: 0.8 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xf1e7d2, roughness: 0.55 });
  const darkInterior = new THREE.MeshBasicMaterial({ color: 0x171614 });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x5c3521, roughness: 0.55 });
  const garageMat = new THREE.MeshStandardMaterial({ color: 0x45525a, roughness: 0.5, metalness: 0.1 });

  makeOpenStorefront(-43, -18, 18, 8, 9, stuccoA, trim, darkInterior, doorMat);
  makeOpenStorefront(42, -24, 20, 9, 10, stuccoB, trim, darkInterior, doorMat);
  makeOpenStorefront(-38, 28, 17, 7, 10, stuccoC, trim, darkInterior, doorMat);
  makeOpenGarage(30, 24, 24, 8, 11, stuccoA, trim, darkInterior, garageMat);
}

function makeOpenStorefront(
  x: number,
  z: number,
  width: number,
  height: number,
  depth: number,
  wallMaterial: THREE.Material,
  trimMaterial: THREE.Material,
  interiorMaterial: THREE.Material,
  doorMaterial: THREE.Material
) {
  const wallThickness = 0.55;
  const doorWidth = 4.4;
  scene.add(solidWall(width, height, wallThickness, x, height / 2, z + depth / 2, wallMaterial));
  scene.add(solidWall(wallThickness, height, depth, x - width / 2 + wallThickness / 2, height / 2, z, wallMaterial));
  scene.add(solidWall(wallThickness, height, depth, x + width / 2 - wallThickness / 2, height / 2, z, wallMaterial));
  scene.add(wall(width, 0.55, depth, x, height + 0.28, z, wallMaterial));
  scene.add(solidWall((width - doorWidth) / 2, height, wallThickness, x - (width + doorWidth) / 4, height / 2, z - depth / 2, wallMaterial));
  scene.add(solidWall((width - doorWidth) / 2, height, wallThickness, x + (width + doorWidth) / 4, height / 2, z - depth / 2, wallMaterial));
  scene.add(wall(doorWidth, height - 5, wallThickness, x, 5 + (height - 5) / 2, z - depth / 2, wallMaterial));
  scene.add(wall(4.4, 4.8, 0.08, x, 2.4, z - depth / 2 - 0.05, interiorMaterial));
  scene.add(wall(5.2, 0.35, 0.25, x, 4.95, z - depth / 2 - 0.2, trimMaterial));
  scene.add(wall(0.32, 4.8, 0.25, x - 2.6, 2.4, z - depth / 2 - 0.2, trimMaterial));
  scene.add(wall(0.32, 4.8, 0.25, x + 2.6, 2.4, z - depth / 2 - 0.2, trimMaterial));

  const doorZ = z - depth / 2 - 0.32;
  const leftDoor = wall(2.1, 4.3, 0.14, x - 1.05, 2.15, doorZ, doorMaterial);
  const rightDoor = wall(2.1, 4.3, 0.14, x + 1.05, 2.15, doorZ, doorMaterial);
  scene.add(leftDoor, rightDoor);
  makeDoor(
    [leftDoor, rightDoor],
    { x, z: doorZ, halfX: doorWidth / 2, halfZ: 0.24 },
    [
      { position: new THREE.Vector3(x - 1.95, 2.15, doorZ - 0.72), rotation: new THREE.Euler(0, -1.08, 0) },
      { position: new THREE.Vector3(x + 1.95, 2.15, doorZ - 0.72), rotation: new THREE.Euler(0, 1.08, 0) },
    ]
  );

  const awning = wall(width * 0.72, 0.35, 2.2, x, height + 0.3, z - depth / 2 - 0.9, trimMaterial);
  awning.rotation.x = 0.14;
  scene.add(awning);
}

function makeOpenGarage(
  x: number,
  z: number,
  width: number,
  height: number,
  depth: number,
  wallMaterial: THREE.Material,
  trimMaterial: THREE.Material,
  interiorMaterial: THREE.Material,
  garageMaterial: THREE.Material
) {
  const wallThickness = 0.55;
  const doorWidth = 9.5;
  scene.add(solidWall(width, height, wallThickness, x, height / 2, z + depth / 2, wallMaterial));
  scene.add(solidWall(wallThickness, height, depth, x - width / 2 + wallThickness / 2, height / 2, z, wallMaterial));
  scene.add(solidWall(wallThickness, height, depth, x + width / 2 - wallThickness / 2, height / 2, z, wallMaterial));
  scene.add(wall(width, 0.55, depth, x, height + 0.28, z, wallMaterial));
  scene.add(solidWall((width - doorWidth) / 2, height, wallThickness, x - (width + doorWidth) / 4, height / 2, z - depth / 2, wallMaterial));
  scene.add(solidWall((width - doorWidth) / 2, height, wallThickness, x + (width + doorWidth) / 4, height / 2, z - depth / 2, wallMaterial));
  scene.add(wall(doorWidth, height - 5.8, wallThickness, x, 5.8 + (height - 5.8) / 2, z - depth / 2, wallMaterial));
  scene.add(wall(9.5, 5.7, 0.1, x, 2.85, z - depth / 2 - 0.06, interiorMaterial));
  scene.add(wall(10.4, 0.36, 0.25, x, 5.86, z - depth / 2 - 0.18, trimMaterial));
  scene.add(wall(0.34, 5.7, 0.25, x - 5.2, 2.85, z - depth / 2 - 0.18, trimMaterial));
  scene.add(wall(0.34, 5.7, 0.25, x + 5.2, 2.85, z - depth / 2 - 0.18, trimMaterial));

  const doorZ = z - depth / 2 - 0.26;
  const rollup = wall(9.6, 5.6, 0.18, x, 2.8, doorZ, garageMaterial);
  scene.add(rollup);
  makeDoor(
    [rollup],
    { x, z: doorZ, halfX: doorWidth / 2, halfZ: 0.3 },
    [{ position: new THREE.Vector3(x, 6.28, z - depth / 2 + 2.4), rotation: new THREE.Euler(Math.PI / 2, 0, 0) }]
  );
}

function makeResidentialBlocks() {
  const houseMaterials = [
    new THREE.MeshStandardMaterial({ color: 0xd8c3a6, roughness: 0.82 }),
    new THREE.MeshStandardMaterial({ color: 0xc6d4cf, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0xd2a789, roughness: 0.82 }),
    new THREE.MeshStandardMaterial({ color: 0xb9c0a8, roughness: 0.78 }),
  ];
  const roofMaterials = [
    new THREE.MeshStandardMaterial({ color: 0x6e3929, roughness: 0.74 }),
    new THREE.MeshStandardMaterial({ color: 0x4d5960, roughness: 0.72 }),
    new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.78 }),
  ];
  const trim = new THREE.MeshStandardMaterial({ color: 0xf0eadc, roughness: 0.58 });
  const door = new THREE.MeshStandardMaterial({ color: 0x5b3322, roughness: 0.58 });
  const glass = new THREE.MeshBasicMaterial({ color: 0xb8d2dd, transparent: true, opacity: 0.8 });

  const lots = [
    [-62, 32, -1], [-42, 35, -1], [-22, 34, -1], [0, 36, -1], [22, 34, -1], [44, 36, -1], [63, 32, -1],
    [-58, -34, 1], [-36, -36, 1], [-14, -34, 1], [10, -36, 1], [34, -35, 1], [58, -34, 1],
    [-70, 54, -1], [-48, 58, -1], [-25, 55, -1], [2, 58, -1], [28, 55, -1], [54, 58, -1], [75, 54, -1],
    [-72, -58, 1], [-50, -55, 1], [-26, -59, 1], [0, -56, 1], [26, -58, 1], [52, -55, 1], [74, -58, 1],
  ] as const;

  lots.forEach(([x, z, facing], index) => {
    makeClosedHouse({
      x,
      z,
      facing,
      width: 12 + (index % 3) * 2,
      depth: 9 + (index % 2) * 2,
      height: 5.4 + (index % 3) * 0.5,
      wallMaterial: houseMaterials[index % houseMaterials.length],
      roofMaterial: roofMaterials[index % roofMaterials.length],
      trimMaterial: trim,
      doorMaterial: door,
      glassMaterial: glass,
    });
  });
}

function makeClosedHouse({
  x,
  z,
  facing,
  width,
  depth,
  height,
  wallMaterial,
  roofMaterial,
  trimMaterial,
  doorMaterial,
  glassMaterial,
}: {
  x: number;
  z: number;
  facing: 1 | -1;
  width: number;
  depth: number;
  height: number;
  wallMaterial: THREE.Material;
  roofMaterial: THREE.Material;
  trimMaterial: THREE.Material;
  doorMaterial: THREE.Material;
  glassMaterial: THREE.Material;
}) {
  const wallThickness = 0.45;
  const doorWidth = 3;
  const frontZ = z + facing * depth / 2;
  const backZ = z - facing * depth / 2;
  const leftX = x - width / 2 + wallThickness / 2;
  const rightX = x + width / 2 - wallThickness / 2;

  scene.add(solidWall(width, height, wallThickness, x, height / 2, backZ, wallMaterial));
  scene.add(solidWall(wallThickness, height, depth, leftX, height / 2, z, wallMaterial));
  scene.add(solidWall(wallThickness, height, depth, rightX, height / 2, z, wallMaterial));
  scene.add(solidWall((width - doorWidth) / 2, height, wallThickness, x - (width + doorWidth) / 4, height / 2, frontZ, wallMaterial));
  scene.add(solidWall((width - doorWidth) / 2, height, wallThickness, x + (width + doorWidth) / 4, height / 2, frontZ, wallMaterial));
  scene.add(wall(doorWidth, height - 3.1, wallThickness, x, 3.1 + (height - 3.1) / 2, frontZ, wallMaterial));
  scene.add(wall(width, 0.45, depth, x, height + 0.2, z, wallMaterial));

  const roof = wall(width + 1.8, 0.85, depth + 1.8, x, height + 0.75, z, roofMaterial);
  roof.rotation.x = facing * 0.03;
  scene.add(roof);

  const porch = wall(4.4, 0.18, 2.6, x, 0.11, frontZ + facing * 1.25, trimMaterial);
  scene.add(porch);

  const doorZ = frontZ + facing * 0.18;
  const door = wall(doorWidth, 3, 0.16, x, 1.5, doorZ, doorMaterial);
  scene.add(door);
  makeDoor(
    [door],
    { x, z: doorZ, halfX: doorWidth / 2, halfZ: 0.28 },
    [
      {
        position: new THREE.Vector3(x - doorWidth * 0.55, 1.5, doorZ + facing * 0.52),
        rotation: new THREE.Euler(0, -facing * 1.18, 0),
      },
    ]
  );

  const windowZ = frontZ + facing * 0.23;
  for (const side of [-1, 1]) {
    const windowFrame = wall(2.1, 1.45, 0.12, x + side * width * 0.28, 2.95, windowZ, trimMaterial);
    const pane = wall(1.65, 1.05, 0.13, x + side * width * 0.28, 2.95, windowZ + facing * 0.03, glassMaterial);
    scene.add(windowFrame, pane);
  }

  const yardMat = new THREE.MeshStandardMaterial({ color: 0x4b6b43, roughness: 0.9 });
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(width + 5, 5), yardMat);
  yard.rotation.x = -Math.PI / 2;
  yard.position.set(x, 0.018, frontZ + facing * 4.5);
  yard.receiveShadow = true;
  scene.add(yard);

  makeHouseInterior(x, z, facing, width, depth);
}

function makeHouseInterior(x: number, z: number, facing: 1 | -1, width: number, depth: number) {
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x8a745e, roughness: 0.78 });
  const rugMat = new THREE.MeshStandardMaterial({ color: 0x8f3241, roughness: 0.82 });
  const couchMat = new THREE.MeshStandardMaterial({ color: 0x2e5f64, roughness: 0.72 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x7b4f2c, roughness: 0.68 });
  const tvMat = new THREE.MeshBasicMaterial({ color: 0x060708 });
  const counterMat = new THREE.MeshStandardMaterial({ color: 0xd8d0c2, roughness: 0.5 });
  const cabinetMat = new THREE.MeshStandardMaterial({ color: 0x6d4a32, roughness: 0.62 });
  const bedMat = new THREE.MeshStandardMaterial({ color: 0x7c8fb1, roughness: 0.76 });
  const pillowMat = new THREE.MeshStandardMaterial({ color: 0xf1eee5, roughness: 0.6 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xd9cfbd, roughness: 0.84 });

  const localZ = (offset: number) => z + facing * offset;
  const frontRoomZ = localZ(depth * 0.2);
  const backRoomZ = localZ(-depth * 0.24);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width - 1.2, depth - 1.2), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(x, 0.035, z);
  floor.receiveShadow = true;
  scene.add(floor);

  const divider = wall(width - 2.2, 2.3, 0.18, x, 1.15, z - facing * 0.42, wallMat);
  scene.add(divider);
  const bedroomDivider = wall(0.18, 2.3, depth * 0.46, x + width * 0.08, 1.15, localZ(-depth * 0.25), wallMat);
  scene.add(bedroomDivider);

  // Living room: couch, TV, coffee table, table and chairs.
  scene.add(wall(width * 0.34, 0.06, 2.6, x - width * 0.2, 0.07, frontRoomZ + facing * 0.5, rugMat));
  scene.add(wall(3.2, 0.65, 0.85, x - width * 0.27, 0.45, frontRoomZ + facing * 1.35, couchMat));
  scene.add(wall(0.38, 0.9, 0.85, x - width * 0.42, 0.55, frontRoomZ + facing * 1.35, couchMat));
  scene.add(wall(0.38, 0.9, 0.85, x - width * 0.12, 0.55, frontRoomZ + facing * 1.35, couchMat));
  scene.add(wall(1.7, 0.32, 0.9, x - width * 0.27, 0.34, frontRoomZ, woodMat));
  scene.add(wall(2.2, 1.25, 0.12, x + width * 0.25, 1.45, frontRoomZ + facing * 1.45, tvMat));
  scene.add(wall(2.5, 0.45, 0.5, x + width * 0.25, 0.35, frontRoomZ + facing * 1.5, woodMat));
  scene.add(wall(1.25, 0.2, 1.25, x + width * 0.1, 0.55, frontRoomZ - facing * 1.15, woodMat));
  for (const [cx, cz] of [
    [-0.95, -1.15],
    [1.15, -1.15],
    [0.1, -2.15],
  ]) {
    scene.add(wall(0.62, 0.62, 0.62, x + width * 0.1 + cx, 0.36, frontRoomZ + facing * cz, woodMat));
  }

  // Kitchen: counter, sink, fridge, stove.
  scene.add(wall(width * 0.36, 0.9, 0.7, x - width * 0.25, 0.52, backRoomZ - facing * 1.45, counterMat));
  scene.add(wall(0.9, 1.8, 0.9, x - width * 0.44, 0.94, backRoomZ - facing * 0.35, counterMat));
  scene.add(wall(0.95, 0.92, 0.86, x - width * 0.1, 0.52, backRoomZ - facing * 1.45, cabinetMat));
  scene.add(wall(0.65, 0.05, 0.48, x - width * 0.23, 1.0, backRoomZ - facing * 1.45, tvMat));

  // Bedroom: bed, pillow, nightstand, dresser.
  scene.add(wall(2.45, 0.55, 3.1, x + width * 0.29, 0.36, backRoomZ - facing * 0.65, bedMat));
  scene.add(wall(2.1, 0.22, 0.65, x + width * 0.29, 0.78, backRoomZ + facing * 0.65, pillowMat));
  scene.add(wall(0.72, 0.65, 0.72, x + width * 0.47, 0.38, backRoomZ + facing * 0.9, woodMat));
  scene.add(wall(1.8, 0.85, 0.6, x + width * 0.15, 0.5, backRoomZ - facing * 1.65, woodMat));
}

function makeStreetGrid() {
  const asphaltMat = new THREE.MeshStandardMaterial({
    color: 0x1d1f20,
    roughness: 0.94,
  });
  const asphalt = new THREE.Mesh(
    new THREE.BoxGeometry(180, 0.12, 22),
    asphaltMat
  );
  asphalt.position.set(0, 0.06, 1);
  asphalt.receiveShadow = true;
  scene.add(asphalt);

  const laneMat = new THREE.MeshBasicMaterial({ color: 0xf6c84f });
  for (let x = -70; x <= 70; x += 16) {
    const stripe = wall(7, 0.045, 0.24, x, 0.145, 1, laneMat);
    scene.add(stripe);
  }

  const curbMat = new THREE.MeshStandardMaterial({ color: 0xddddcf, roughness: 0.68 });
  scene.add(wall(180, 0.22, 0.5, 0, 0.11, -10.8, curbMat));
  scene.add(wall(180, 0.22, 0.5, 0, 0.11, 12.8, curbMat));
}

function makePalmRows() {
  for (let i = 0; i < 11; i++) {
    makePalm(-54 + i * 11, -13.5, 9 + (i % 3) * 0.7);
    if (i % 2 === 0) makePalm(-49 + i * 11, 16.5, 8.5 + (i % 4) * 0.55);
  }
}

function makePalm(x: number, z: number, height: number) {
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6c4b32, roughness: 0.82 });
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2e6b3f, roughness: 0.72, side: THREE.DoubleSide });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, height, 10), trunkMat);
  trunk.position.set(x, height / 2, z);
  trunk.rotation.z = (Math.random() - 0.5) * 0.08;
  trunk.castShadow = true;
  scene.add(trunk);

  for (let i = 0; i < 8; i++) {
    const frond = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 5.6), frondMat);
    frond.position.set(x, height + 0.15, z);
    frond.rotation.y = (Math.PI * 2 * i) / 8;
    frond.rotation.x = 1.1;
    frond.castShadow = true;
    scene.add(frond);
  }
}

function makeOpenProps() {
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x887d6b, roughness: 0.76 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x303437, metalness: 0.55, roughness: 0.35 });
  for (const [x, z, w, h] of [
    [-12, -25, 10, 3],
    [11, -31, 8, 4],
    [-10, 30, 9, 3],
    [8, 34, 7, 5],
  ]) {
    scene.add(wall(w, h, 4, x, h / 2, z, wallMat));
  }

  for (let i = 0; i < 8; i++) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 8, 12), metalMat);
    pole.position.set(-46 + i * 13, 4, -11.5);
    pole.castShadow = true;
    scene.add(pole);
    const lamp = new THREE.PointLight(0xffdfaa, 1.3, 24);
    lamp.position.copy(pole.position).y = 7.6;
    scene.add(lamp);
  }
}

function makeTextTexture(text: string, color: string, background: string) {
  const source = document.createElement("canvas");
  source.width = 1024;
  source.height = 256;
  const ctx = source.getContext("2d")!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, source.width, source.height);
  ctx.fillStyle = color;
  ctx.font = "900 120px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, source.width / 2, source.height / 2);
  const texture = new THREE.CanvasTexture(source);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function spawnTargets() {
  for (let i = 0; i < 14; i++) {
    const target = makeTarget(i);
    resetTarget(target, i);
    targets.push(target);
    scene.add(target.mesh);
  }
}

function makeTarget(index: number): Target {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.55, 1.35, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0xd54437, roughness: 0.48, metalness: 0.02 })
  );
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 0.9, 0.12),
    new THREE.MeshStandardMaterial({ color: 0xf7f2e8, roughness: 0.35 })
  );
  plate.position.set(0, 0.32, -0.42);
  const bull = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.04, 32),
    new THREE.MeshBasicMaterial({ color: 0x111111 })
  );
  bull.rotation.x = Math.PI / 2;
  bull.position.set(0, 0.32, -0.5);
  group.add(base, plate, bull);
  group.traverse((child) => {
    child.castShadow = true;
    child.receiveShadow = true;
    child.userData.targetIndex = index;
  });
  return { mesh: group, health: 100, maxHealth: 100, radius: 0.9, velocity: new THREE.Vector3(), respawnAt: 0 };
}

function resetTarget(target: Target, index: number) {
  target.health = target.maxHealth;
  target.mesh.visible = true;
  target.mesh.position.set(-42 + (index % 7) * 14, 1.1, -18 - Math.floor(index / 7) * 18 - Math.random() * 8);
  target.velocity.set((Math.random() - 0.5) * 4, 0, (Math.random() - 0.5) * 2.4);
}

function renderWeaponBar() {
  const node = document.querySelector<HTMLDivElement>("#weapons")!;
  node.innerHTML = weapons
    .map((weapon, index) => `<button class="${index === currentWeaponIndex ? "active" : ""}" data-index="${index}"><b>${index + 1}</b>${weapon.name}</button>`)
    .join("");
  node.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => switchWeapon(Number((button as HTMLButtonElement).dataset.index)));
  });
}

function updateHud() {
  const weapon = weapons[currentWeaponIndex];
  document.querySelector("#weapon")!.textContent = performance.now() < reloadUntil ? "Reloading" : weapon.name;
  document.querySelector("#ammo")!.textContent = `${weapon.ammo} / ${weapon.reserve}`;
  document.querySelector("#score")!.textContent = String(score);
  document.querySelector("#streak")!.textContent = String(streak);
  document.body.style.setProperty("--hit", String(hitFlash));
}

function addFeed(message: string) {
  const feed = document.querySelector<HTMLDivElement>("#feed")!;
  const item = document.createElement("div");
  item.textContent = message;
  feed.prepend(item);
  setTimeout(() => item.remove(), 1800);
}

function makeCanvasTexture(kind: "concrete") {
  const source = document.createElement("canvas");
  source.width = 512;
  source.height = 512;
  const ctx = source.getContext("2d")!;
  ctx.fillStyle = "#7f8580";
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const shade = 80 + Math.random() * 95;
    ctx.fillStyle = `rgba(${shade},${shade},${shade},${Math.random() * 0.16})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  ctx.strokeStyle = "rgba(40,42,40,.24)";
  ctx.lineWidth = 2;
  for (let i = 0; i <= 512; i += 128) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }
  return new THREE.CanvasTexture(source);
}
