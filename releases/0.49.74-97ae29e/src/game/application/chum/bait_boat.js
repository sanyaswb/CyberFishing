import { Vector2 } from "../../../engine/math/vector2.js";
import { BoatRules } from "../../domain/rules/boat_rules.js";
import {
  BOAT_ANIMATION_CLIPS,
  BOAT_ANIMATION_DURATIONS,
  BOAT_SECTION_CLIPS,
} from "../../domain/chum/boat_animation_state.js";

const BOAT_RULES = new BoatRules();
// The boat waits for its clips (TK-160: one source of their lengths).
const IMMERSION_SEC = BOAT_ANIMATION_DURATIONS[BOAT_ANIMATION_CLIPS.IMMERSION];
const MOVE_START_SEC = BOAT_ANIMATION_DURATIONS[BOAT_ANIMATION_CLIPS.MOVE_START];
// Spec 154: progress along a leg is checked over this many seconds; after this many replans a trip gives up.
const NO_PROGRESS_SEC = 3;
const MAX_REPLANS = 3;
// The per-frame damping the boat was tuned with at 60 Hz, applied per second of time instead (spec 154).
const FRAME_RATE_OF_TUNING = 60;
// TK-161: a route point counts as reached within this many ground-plane pixels (0.5 m). Not a share of the cell size:
// the ground plane stretches far cells vertically only, so a cell-based radius skipped points beside obstacles far away.
const ROUTE_POINT_REACH = 25;

export class BaitBoat {
  #rootInstanceId;
  #sensorRays = Array.from({ length: 3 }, () => ({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    isBlocked: false,
  }));
  #sensorTimer = 0;
  #sensorInterval = 0.15;
  #cachedSensors = null;
  #lastScanData = { lookDist: 0, angles: [0, 0, 0] };
  #rayPoint = { x: 0, y: 0 };
  #targetInfo = { dx: 0, dy: 0, dist: 1, goalDist: 0 };
  #bestGoalDist = Infinity;
  #noProgressSec = 0;
  #replans = 0;
  #inertial = false;
  #motionParams = { acceleration: 0, turnSpeedRad: 0, turnAtRestShare: 1, dragPerTick: 0, lateralPerTick: 0 };

  // drop: { baitId, slotIndex } the boat carries to its current target; the bunker opening spends that cargo slot and
  // starts the spot (specs 151 D5, 152 D2).
  // batteryInstanceId: the battery in the boat's slot at launch (spec 143); ChumService consumes it.
  constructor(startX, startY, config, drop = null, batteryInstanceId = null) {
    this.startPos = new Vector2(startX, startY);
    this.pos = new Vector2(startX, startY);
    this.target = null;
    const statsConfig = config.effectiveStats || config;
    this.config = Object.assign({}, statsConfig, {
      skin: config.skin || statsConfig.skin || null,
      emoji: statsConfig.emoji || config.icon || "🚤",
    });
    this.skin = this.config.skin;
    // The equipped delivery slot may change while this boat is away. Keep the
    // identity of the assembly that actually started the trip on the runtime
    // boat so the return event can refill that exact root.
    this.#rootInstanceId = config?.instanceId || null;
    this.stats =
      statsConfig.statsByLevel?.[statsConfig.upgradeLevel] ||
      statsConfig.statsByLevel?.[1] ||
      statsConfig.statsByLevel ||
      {};
    this.drop = drop;
    this.velocity = new Vector2(0, 0);
    this.angle = -Math.PI / 2;
    this.batteryInstanceId = batteryInstanceId;
    // The battery's remaining share (0..1) for the boat's charge bar; written by ChumService.
    this.powerRatio = 1;
    this.state = "idle";
    this.isBaitDropped = false;
    this.isFinished = false;
    this.hasLeftShore = false;
    const initialDropped = Array.isArray(statsConfig.initialDroppedSections)
      ? [...statsConfig.initialDroppedSections]
      : Array.isArray(config.initialDroppedSections)
        ? [...config.initialDroppedSections]
        : [];
    this.droppedSections = initialDropped;
    this.sectionCount = BOAT_RULES.sectionCount(statsConfig);
    this.remainingSections = Math.max(0, this.sectionCount - initialDropped.length);
    this.waypoints = [];
    // Spec 154: the planned route of the current leg (map points after the boat, ending at the leg's goal). ChumService
    // plans it on the current map whenever needsRoute is set; an empty route steers straight at the goal.
    this.route = [];
    this.needsRoute = false;

    this.animationState = "immersion";
    this.immersionTimer = IMMERSION_SEC;
    this.moveStartTimer = 0;
    this.openingTimer = 0;
    this.openingSectionIndex = 1;

    this.avoidanceState = "none";
    this.avoidanceTimer = 0;
    this.avoidanceTargetAngle = 0;
    this.engineThrottle = 1.0;
    this.persistenceTimer = 0;
    this.maneuverTimer = 0;
  }


  // Spec 151 D6: a launched boat survives a page reload. Everything its trip needs, in map coordinates.
  toSnapshot() {
    return {
      x: this.pos.x, y: this.pos.y, startX: this.startPos.x, startY: this.startPos.y, angle: this.angle,
      state: this.state, target: this.target ? { x: this.target.x, y: this.target.y } : null, drop: this.drop,
      waypoints: this.waypoints.map((waypoint) => ({ ...waypoint })), droppedSections: [...this.droppedSections],
      remainingSections: this.remainingSections, hasLeftShore: this.hasLeftShore, powerRatio: this.powerRatio,
      animationState: this.animationState, openingTimer: this.openingTimer,
      openingSectionIndex: this.openingSectionIndex, isBaitDropped: this.isBaitDropped,
    };
  }

  restore(snapshot) {
    this.pos.set(snapshot.x, snapshot.y);
    this.startPos.set(snapshot.startX, snapshot.startY);
    this.angle = snapshot.angle;
    this.state = snapshot.state;
    this.target = snapshot.target ? new Vector2(snapshot.target.x, snapshot.target.y) : null;
    this.drop = snapshot.drop ?? null;
    this.waypoints = snapshot.waypoints.map((waypoint) => ({ ...waypoint }));
    this.droppedSections = [...snapshot.droppedSections];
    this.remainingSections = snapshot.remainingSections;
    this.hasLeftShore = snapshot.hasLeftShore;
    this.powerRatio = snapshot.powerRatio;
    // A reload resumes without the one-shot clips: immersion is over, a start continues as motion (TK-160).
    const resumed = { immersion: "idle", moving_start: "moving" };
    this.animationState = resumed[snapshot.animationState] ?? snapshot.animationState;
    this.moveStartTimer = 0;
    this.immersionTimer = 0;
    this.openingTimer = snapshot.openingTimer;
    this.openingSectionIndex = snapshot.openingSectionIndex;
    this.isBaitDropped = snapshot.isBaitDropped;
    this.route = [];
    this.needsRoute = this.state === "deploying" || this.state === "returning";
    return this;
  }

  get sensorRays() {
    if (this.config.showSensors === false) return [];
    return this.#sensorRays;
  }

  get rootInstanceId() {
    return this.#rootInstanceId;
  }

  // Maps the sensor rays' end points in place (spec 054: BaitBoatGroundPlaneScope moves them between the map and the
  // ground plane). map(x, y, out) writes out.x / out.y.
  mapSensorRays(map) {
    const point = this.#rayPoint;
    for (let index = 0; index < this.#sensorRays.length; index += 1) {
      const ray = this.#sensorRays[index];
      map(ray.startX, ray.startY, point);
      ray.startX = point.x;
      ray.startY = point.y;
      map(ray.endX, ray.endY, point);
      ray.endX = point.x;
      ray.endY = point.y;
    }
  }

  setTarget(targetX, targetY, drop = null, isReturn = false) {
    if (this.state === "drifting") return;

    const isManual = this.config.manualControl;

    if (!isManual && !isReturn && this.state === "deploying") {
      this.waypoints.push({ x: targetX, y: targetY, drop });
      return;
    }

    this.target = new Vector2(targetX, targetY);
    if (drop !== null) this.drop = drop;
    this.state = isReturn ? "returning" : "deploying";
    this.#beginLeg();
    this.animationState = "moving_start";
    this.moveStartTimer = MOVE_START_SEC;
  }

  update(dt, checkPhysics, checkSensor, cellSize, env) {
    const dtSec = dt * 0.001;
    if (this.immersionTimer > 0) {
      this.immersionTimer = Math.max(0, this.immersionTimer - dtSec);
      if (this.immersionTimer === 0 && this.state === "idle") {
        this.animationState = "idle";
      }
    }
    if (this.state === "idle" || this.isFinished) return;

    this.persistenceTimer = Math.max(0, this.persistenceTimer - dtSec);
    this.maneuverTimer = Math.max(0, this.maneuverTimer - dtSec);
    if (this.moveStartTimer > 0) {
      this.moveStartTimer = Math.max(0, this.moveStartTimer - dtSec);
      // Only a start becomes motion: a bunker that began opening meanwhile keeps opening (TK-160).
      if (this.moveStartTimer === 0 && this.animationState === "moving_start" &&
        (this.state === "deploying" || this.state === "returning")) {
        this.animationState = "moving";
      }
    }
    const isManual = this.config.manualControl;

    this.#sensorTimer -= dtSec;
    if (this.#sensorTimer <= 0 || !this.#cachedSensors) {
      this.#cachedSensors = this.#scanEnvironment(
        checkPhysics,
        checkSensor,
        cellSize,
      );
      this.#sensorTimer = this.#sensorInterval;
    }

    if (this.state === "waiting" || this.state === "drifting") {
      this.#applyDrift(dtSec, checkPhysics, env);
      this.#syncRayPositions();
      return;
    }

    this.#syncRayPositions();

    const targetInfo = this.#calculateTargetInfo();
    const obstacles = this.#cachedSensors;

    if (isManual) {
      const targetAlignment =
        (targetInfo.dx / targetInfo.dist) * Math.cos(this.angle) +
        (targetInfo.dy / targetInfo.dist) * Math.sin(this.angle);

      if (
        obstacles.isBumperHit &&
        targetAlignment > -0.2 &&
        this.avoidanceState === "none"
      ) {
        this.engineThrottle = Math.max(0, this.engineThrottle - dtSec * 1.5);

        if (
          this.engineThrottle === 0 &&
          Math.hypot(this.velocity.x, this.velocity.y) < 15
        ) {
          this.state = "waiting";
          return;
        }
      } else {
        this.engineThrottle = Math.min(1.0, this.engineThrottle + dtSec * 2.0);
      }
    } else {
      this.engineThrottle = 1.0;
    }

    if (this.#checkArrival(targetInfo, obstacles, isManual, dtSec)) return;

    const steering = this.#calculateSteering(
      targetInfo,
      obstacles,
      isManual,
      dtSec,
    );
    this.#applyPhysics(steering, dtSec);
    this.#moveAndCollide(dtSec, checkPhysics, isManual);
    this.#checkShoreParking(isManual);
    this.#watchProgress(targetInfo.goalDist, dtSec, isManual);
  }

  #syncRayPositions() {
    if (!this.#lastScanData.lookDist) return;
    const { lookDist, angles } = this.#lastScanData;

    for (let i = 0; i < 3; i++) {
      const ray = this.#sensorRays[i];
      const checkAngle = this.angle + angles[i];

      ray.startX = this.pos.x;
      ray.startY = this.pos.y;
      ray.endX = this.pos.x + Math.cos(checkAngle) * lookDist;
      ray.endY = this.pos.y + Math.sin(checkAngle) * lookDist;
    }
  }

  // Spec 143: the battery is empty; the boat drifts with the current (as it did when its own energy ran out).
  runOutOfPower() {
    if (this.state === "idle" || this.isFinished) return;
    this.powerRatio = 0;
    this.state = "drifting";
    // The motor stops: no motion clip or wake while it drifts (TK-160).
    this.animationState = "idle";
    this.moveStartTimer = 0;
  }

  #applyDrift(dtSec, checkPhysics, env) {
    if (!env || !env.current) return;

    const driftSpeed = env.current.speedPxPerSec * 0.8;
    const dx = env.current.direction.x * driftSpeed * dtSec;
    const dy = env.current.direction.y * driftSpeed * dtSec;

    if (checkPhysics) {
      if (checkPhysics(this.pos.x + dx, this.pos.y)) this.pos.x += dx;
      if (checkPhysics(this.pos.x, this.pos.y + dy)) this.pos.y += dy;
    }

    if (this.state === "drifting") {
      const targetAngle = Math.atan2(
        env.current.direction.y,
        env.current.direction.x,
      );
      let angleDiff = targetAngle - this.angle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      this.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), dtSec);
    }
  }

  // Direction to the next route point; goalDist is the remaining length along the route to the leg's goal (arrival,
  // braking and progress use it). Route points within ROUTE_POINT_REACH are passed.
  #calculateTargetInfo() {
    const route = this.route;
    while (route.length > 1 && Math.hypot(route[0].x - this.pos.x, route[0].y - this.pos.y) < ROUTE_POINT_REACH) {
      route.shift();
    }
    const aim = route.length > 0 ? route[0] : this.legGoal;
    const info = this.#targetInfo;
    info.dx = aim.x - this.pos.x;
    info.dy = aim.y - this.pos.y;
    info.dist = Math.hypot(info.dx, info.dy) || 1;
    let goalDist = info.dist;
    for (let index = 1; index < route.length; index += 1) {
      goalDist += Math.hypot(route[index].x - route[index - 1].x, route[index].y - route[index - 1].y);
    }
    info.goalDist = goalDist;
    return info;
  }

  #scanEnvironment(checkPhysics, checkSensor, cellSize) {
    const speedRatio = Math.min(
      1.0,
      Math.hypot(this.velocity.x, this.velocity.y) / this.stats.speedPxPerSec,
    );
    const rangeFactor = this.config.sensorRangeFactor || 1.5;

    // Range combines the base distance and the speed-dependent bonus.
    const lookDist = cellSize * rangeFactor + speedRatio * cellSize * 2.0;
    const currentSpread = Math.PI / 2 - (Math.PI / 3) * speedRatio;

    const angles = [0, -currentSpread, currentSpread];
    this.#lastScanData = { lookDist, angles };
    const obstacleWeights = [false, false, false];
    let isForwardBlocked = false;

    for (let i = 0; i < 3; i++) {
      const checkAngle = this.angle + angles[i];
      let isRayBlocked = false;

      const testSteps = [0.5, 1.0];
      for (const step of testSteps) {
        const px = this.pos.x + Math.cos(checkAngle) * lookDist * step;
        const py = this.pos.y + Math.sin(checkAngle) * lookDist * step;

        if (checkSensor && checkSensor(px, py)) {
          isRayBlocked = true;
          break;
        }
      }

      obstacleWeights[i] = isRayBlocked;

      // Reuse the existing vectors instead of allocating new ones.
      const ray = this.#sensorRays[i];
      ray.startX = this.pos.x;
      ray.startY = this.pos.y;
      ray.endX = this.pos.x + Math.cos(checkAngle) * lookDist;
      ray.endY = this.pos.y + Math.sin(checkAngle) * lookDist;
      ray.isBlocked = isRayBlocked;

      if (i === 0 && isRayBlocked) isForwardBlocked = true;
    }

    const bumperX = this.pos.x + Math.cos(this.angle) * (cellSize * 0.6);
    const bumperY = this.pos.y + Math.sin(this.angle) * (cellSize * 0.6);
    const isBumperHit = checkPhysics ? !checkPhysics(bumperX, bumperY) : false;

    return { isForwardBlocked, isBumperHit, obstacleWeights, lookDist };
  }

  #setAvoidance(newState, time, angle) {
    this.avoidanceState = newState;
    this.avoidanceTimer = time;
    this.avoidanceTargetAngle = angle;
  }

  #calculateSteering({ dx, dy, dist, goalDist }, sensors, isManual, dtSec) {
    const slowRadius = Math.max(1, this.config.slowRadius || 150);
    const t = Math.min(goalDist / slowRadius, 1.0);
    const arrivalRatio = t * t;

    // Spec 154: a planned route already avoids land and obstacles; the rays are the fallback without one (D2).
    const isBlindZone = goalDist < sensors.lookDist * 1.5 || this.route.length > 0;

    if (this.avoidanceTimer > 0) {
      this.avoidanceTimer -= dtSec;
      const maneuverTime = this.config.maneuver?.maneuverTimeSec || 1.5;

      if (this.avoidanceTimer <= 0) {
        if (this.avoidanceState === "reversing") {
          this.maneuverTimer = maneuverTime;
          if (!isManual) {
            const turnDir = sensors.obstacleWeights[1] ? 1 : -1;
            this.#setAvoidance(
              "evading",
              0.6,
              this.angle + (Math.PI / 2) * turnDir,
            );
          } else {
            this.#setAvoidance("none", 0, 0);
          }
        } else {
          this.#setAvoidance("none", 0, 0);
        }
      } else if (
        this.avoidanceState === "reversing" &&
        !sensors.isForwardBlocked
      ) {
        if (this.avoidanceTimer <= 0.5) {
          this.maneuverTimer = 1.5;
          if (!isManual) {
            const turnDir = sensors.obstacleWeights[1] ? 1 : -1;
            this.#setAvoidance(
              "evading",
              0.6,
              this.angle + (Math.PI / 2) * turnDir,
            );
          } else {
            this.#setAvoidance("none", 0, 0);
          }
        }
      }
    }

    const targetAlignment =
      (dx / dist) * Math.cos(this.angle) + (dy / dist) * Math.sin(this.angle);
    const isGoingTowardsWall = targetAlignment > -0.2;

    // Avoidance and reversing apply to both control modes.
    if (this.avoidanceState === "none") {
      const reverseTime = this.config.maneuver?.reverseTimeSec || 1.2;

      if (isManual) {
        if (sensors.isBumperHit && !isGoingTowardsWall) {
          this.#setAvoidance("reversing", reverseTime, this.angle);
        }
      } else {
        if (!isBlindZone) {
          const isStuck =
            Math.hypot(this.velocity.x, this.velocity.y) < 10 &&
            sensors.isForwardBlocked &&
            isGoingTowardsWall;
          if (sensors.isBumperHit || isStuck) {
            this.#setAvoidance("reversing", reverseTime, this.angle);
          } else if (sensors.isForwardBlocked && isGoingTowardsWall) {
            const turnDir = sensors.obstacleWeights[1] ? 1 : -1;
            this.#setAvoidance(
              "evading",
              0.5,
              this.angle + (Math.PI / 2) * turnDir,
            );
          }
        }
      }
    }

    if (this.avoidanceState === "reversing") {
      return {
        x: -Math.cos(this.avoidanceTargetAngle),
        y: -Math.sin(this.avoidanceTargetAngle),
        brake: 0,
      };
    }
    if (this.avoidanceState === "evading") {
      return {
        x: Math.cos(this.avoidanceTargetAngle),
        y: Math.sin(this.avoidanceTargetAngle),
        brake: 0.3,
      };
    }

    let steerX = (dx / dist) * arrivalRatio;
    let steerY = (dy / dist) * arrivalRatio;
    let hazardBrake = 0;

    // Obstacle avoidance persists for the configured duration.
    const isForwardBlocked = sensors.isForwardBlocked;
    const isParking = this.state === "returning";

    // Choose an open side for steering around the obstacle.
    const turnDir = sensors.obstacleWeights[1] ? 1 : -1;
    const clearAngle =
      sensors.obstacleWeights[1] && sensors.obstacleWeights[2]
        ? null
        : this.angle + (Math.PI / 2) * turnDir;


    const persistenceTime = (this.config.avoidancePersistenceMs || 300) / 1000;
    const thrustMult = this.config.avoidanceThrustMultiplier || 0.1;


    if (isForwardBlocked) {
      this.persistenceTimer = persistenceTime;
    }

    // Keep avoiding while the wall is visible or the persistence timer is active.
    const inAvoidanceMode =
      (isForwardBlocked || this.persistenceTimer > 0) && !isParking && this.route.length === 0;

    if (!isManual && inAvoidanceMode && this.avoidanceState === "none") {

      steerX *= thrustMult;
      steerY *= thrustMult;

      if (clearAngle !== null) {
        steerX += Math.cos(clearAngle) * 4;
        steerY += Math.sin(clearAngle) * 4;
      } else {
        // Reverse when neither side offers an escape route.
        steerX -= Math.cos(this.angle) * 4;
        steerY -= Math.sin(this.angle) * 4;
      }
    }

    const targetBrake =
      goalDist < slowRadius && this.avoidanceState === "none"
        ? (this.config.brakeForce || 0.5) * (1.0 - arrivalRatio)
        : 0;
    return { x: steerX, y: steerY, brake: Math.max(targetBrake, hazardBrake) };
  }

  #moveAndCollide(dtSec, checkPhysics, isManual) {
    const moveX = this.velocity.x * dtSec;
    const moveY = this.velocity.y * dtSec;
    const nextX = this.pos.x + moveX;
    const nextY = this.pos.y + moveY;

    if (checkPhysics) {
      const cellX = checkPhysics(nextX, this.pos.y);
      const cellY = checkPhysics(this.pos.x, nextY);

      if (cellX !== null) {
        this.pos.x = nextX;
      } else {
        this.velocity.x = 0;
        this.pos.x -=
          moveX !== 0 ? Math.sign(moveX) * 2 : Math.cos(this.angle) * 2;
      }

      if (cellY !== null) {
        this.pos.y = nextY;
      } else {
        this.velocity.y = 0;
        this.pos.y -=
          moveY !== 0 ? Math.sign(moveY) * 2 : Math.sin(this.angle) * 2;
      }

      if (cellX === null && cellY === null && isManual) this.state = "waiting";
    } else {
      this.pos.x = nextX;
      this.pos.y = nextY;
    }
  }

  #checkArrival({ goalDist: dist }, { isForwardBlocked }, isManual, dtSec = 0) {
    const cfg = this.config;
    const targetRad = cfg.finishRadiusTarget || 10;
    const finishRad =
      this.state === "returning" ? cfg.finishRadiusReturning || 30 : targetRad;

    const speed = Math.hypot(this.velocity.x, this.velocity.y);

    const isCloseEnough = dist < finishRad;
    const isStalled = speed < 15 && dist < finishRad * 2.5;
    const isSmartDrop =
      !isManual && this.state === "deploying" && dist < 45 && isForwardBlocked;

    if (isCloseEnough || isStalled || isSmartDrop) {
      if (this.state === "deploying") {
        if (!isManual) {
          if (this.drop && !this.isBaitDropped) {
            if (this.animationState !== "opening") {
              this.animationState = "opening";
              let dropNum = 1;
              for (let s = 1; s <= this.sectionCount; s++) {
                if (!this.droppedSections.includes(s)) {
                  dropNum = s;
                  break;
                }
              }
              this.openingSectionIndex = dropNum;
              // A bunker without its own clip opens at once.
              this.openingTimer = BOAT_ANIMATION_DURATIONS[BOAT_SECTION_CLIPS[dropNum]] ?? 0;
              this.velocity.x = 0;
              this.velocity.y = 0;
              return true;
            }
            // Opening: the bunker drops when its clip has played (a bunker without a clip on the next step).
            {
              this.openingTimer -= dtSec;
              this.velocity.x = 0;
              this.velocity.y = 0;
              if (this.openingTimer <= 0) {
                this.isBaitDropped = true;
                if (!this.droppedSections.includes(this.openingSectionIndex)) {
                  this.droppedSections.push(this.openingSectionIndex);
                }
                this.remainingSections--;
                this.animationState = "idle";
              }
              return true;
            }
          }

          if (this.isBaitDropped) return true;

          if (this.waypoints.length > 0) {
            this.#processNextWaypoint();
            return true;
          } else {
            this.drop = null;
            this.state = "returning";
            this.#beginLeg();
            this.animationState = "moving_start";
            this.moveStartTimer = MOVE_START_SEC;
          }
        } else {
          this.state = "waiting";
        }
      } else if (this.state === "returning") {
        this.isFinished = true;
      }
      return true;
    }
    return false;
  }

  #processNextWaypoint() {
    if (this.waypoints.length > 0) {
      let closestIdx = 0;
      let minSq = Infinity;

      for (let i = 0; i < this.waypoints.length; i++) {
        const wpx = this.waypoints[i].x - this.pos.x;
        const wpy = this.waypoints[i].y - this.pos.y;
        const dSqSq = wpx * wpx + wpy * wpy;
        if (dSqSq < minSq) {
          minSq = dSqSq;
          closestIdx = i;
        }
      }

      const wp = this.waypoints.splice(closestIdx, 1)[0];
      this.target.x = wp.x;
      this.target.y = wp.y;
      this.drop = wp.drop;
      this.#beginLeg();
      this.animationState = "moving_start";
      this.moveStartTimer = MOVE_START_SEC;
    } else {
      this.state = "returning";
      this.#beginLeg();
      this.animationState = "moving_start";
      this.moveStartTimer = MOVE_START_SEC;
    }
  }

  // Spec 154 C: the DEV switch between the tuned agile motion and the catalog's inertial preset (motionPresets.inertial).
  setInertialMotion(enabled) {
    this.#inertial = enabled === true && !!this.config.motionPresets?.inertial;
  }

  // Thrust, turn rate (its share at rest grows to full at top speed), drag and side-slip kept per 60 Hz tick.
  #motion() {
    const preset = this.#inertial ? this.config.motionPresets.inertial : null;
    const motion = this.#motionParams;
    motion.acceleration = preset?.acceleration ?? (this.config.acceleration || 400);
    motion.turnSpeedRad = preset?.turnSpeedRad ?? (this.config.turnSpeedRad || 3.0);
    motion.turnAtRestShare = preset?.turnAtRestShare ?? 1;
    motion.dragPerTick = preset?.dragPerTick ?? 0.97;
    motion.lateralPerTick = preset?.lateralPerTick ?? 0.05;
    return motion;
  }

  // The leg's goal: the target while deploying, the shore start on the way back.
  get legGoal() {
    return this.state === "deploying" ? this.target : this.startPos;
  }

  setRoute(points) {
    this.route = points ? points.map((point) => ({ x: point.x, y: point.y })) : [];
    this.needsRoute = false;
  }

  #beginLeg() {
    this.route = [];
    this.needsRoute = true;
    this.#bestGoalDist = Infinity;
    this.#noProgressSec = 0;
    this.#replans = 0;
  }

  // Spec 154: no progress toward the leg's goal for NO_PROGRESS_SEC replans the route; after MAX_REPLANS a deploying
  // boat gives up its remaining targets (their cargo stays in the bunkers) and comes back.
  #watchProgress(goalDist, dtSec, isManual) {
    if (isManual || this.animationState === "opening" || (this.state !== "deploying" && this.state !== "returning")) {
      return;
    }
    if (goalDist < this.#bestGoalDist - 5) {
      this.#bestGoalDist = goalDist;
      this.#noProgressSec = 0;
      return;
    }
    this.#noProgressSec += dtSec;
    if (this.#noProgressSec < NO_PROGRESS_SEC) return;
    this.#noProgressSec = 0;
    this.#bestGoalDist = goalDist;
    this.#replans += 1;
    if (this.#replans > MAX_REPLANS && this.state === "deploying") {
      this.waypoints.length = 0;
      this.drop = null;
      this.state = "returning";
      this.#beginLeg();
      return;
    }
    this.route = [];
    this.needsRoute = true;
  }

  #applyPhysics(steering, dtSec) {
    const motion = this.#motion();
    const accel = motion.acceleration;
    const isReversing = this.avoidanceState === "reversing";
    const steeringMag = Math.hypot(steering.x, steering.y);
    const noseX = Math.cos(this.angle);
    const noseY = Math.sin(this.angle);

    if (steeringMag > 0.01) {
      let desiredAngle = Math.atan2(steering.y, steering.x);
      if (isReversing) desiredAngle += Math.PI;

      let angleDiff = desiredAngle - this.angle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;


      const speedShare = Math.min(1, Math.hypot(this.velocity.x, this.velocity.y) /
        Math.max(1, this.stats.speedPxPerSec || 1));
      const turnShare = motion.turnAtRestShare + (1 - motion.turnAtRestShare) * speedShare;
      const maxTurn = motion.turnSpeedRad * turnShare * dtSec;
      this.angle +=
        Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), maxTurn);

      if (isReversing) {
        const reverseMult = this.config.maneuver?.reverseThrustMult || 0.8;
        const reverseThrust = accel * dtSec * reverseMult;
        this.velocity.x -= noseX * reverseThrust;
        this.velocity.y -= noseY * reverseThrust;
      } else {
        const alignment =
          (steering.x / steeringMag) * noseX +
          (steering.y / steeringMag) * noseY;

        // TK-161: a twin-motor bait boat turns on the spot; it pushes forward only toward an aim ahead of it, so a leg that
        // starts behind it (the way home after a drop) does not swing into the shore or an obstacle.
        const alignFactor = Math.max(0, alignment);

        const maneuverThrust = this.config.maneuver?.maneuverThrustMult || 0.3;
        const maneuverPenalty = this.maneuverTimer > 0 ? maneuverThrust : 1.0;

        const thrustMultiplier =
          steeringMag < 0.5 && alignment < 0.7 ? 0.1 : 1.0;

        const forwardThrust =
          alignFactor * accel * dtSec * thrustMultiplier * maneuverPenalty;

        this.velocity.x += noseX * forwardThrust;
        this.velocity.y += noseY * forwardThrust;
      }
    }

    const rightX = -noseY;
    const rightY = noseX;
    const forwardSpeed = this.velocity.x * noseX + this.velocity.y * noseY;
    let lateralSpeed = this.velocity.x * rightX + this.velocity.y * rightY;

    lateralSpeed *= Math.pow(motion.lateralPerTick, dtSec * FRAME_RATE_OF_TUNING);

    this.velocity.x = noseX * forwardSpeed + rightX * lateralSpeed;
    this.velocity.y = noseY * forwardSpeed + rightY * lateralSpeed;

    if (steering.brake > 0) {
      const brakeFriction = Math.max(0, 1.0 - steering.brake * dtSec * 7);
      this.velocity.x *= brakeFriction;
      this.velocity.y *= brakeFriction;
    }

    const drag = Math.pow(motion.dragPerTick, dtSec * FRAME_RATE_OF_TUNING);
    this.velocity.x *= drag;
    this.velocity.y *= drag;

    const maneuverSpeed = this.config.maneuver?.maneuverSpeedMult || 0.4;
    const maxSpeed =
      this.maneuverTimer > 0
        ? this.stats.speedPxPerSec * maneuverSpeed
        : this.stats.speedPxPerSec;

    const vMag = Math.hypot(this.velocity.x, this.velocity.y);
    if (vMag > maxSpeed) {
      this.velocity.x = (this.velocity.x / vMag) * maxSpeed;
      this.velocity.y = (this.velocity.y / vMag) * maxSpeed;
    }
  }

  #checkShoreParking(isManual) {
    if (!this.hasLeftShore && this.startPos.y - this.pos.y > 50) {
      this.hasLeftShore = true;
    }

    if (
      this.hasLeftShore &&
      this.state === "returning" &&
      this.pos.y >= this.startPos.y - 30
    ) {
      if (!isManual) {
        this.isFinished = true;
      } else {
        this.state = "waiting";
      }
    }
  }
}
