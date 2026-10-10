import { Vector2 } from "../../../engine/math/vector2.js";

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

  constructor(startX, startY, config, zoneId = null, initialEnergy = null) {
    this.startPos = new Vector2(startX, startY);
    this.pos = new Vector2(startX, startY);
    this.target = null;
    const statsConfig = config.effectiveStats || config;
    this.config = statsConfig;
    // The equipped delivery slot may change while this boat is away. Keep the
    // identity of the assembly that actually started the trip on the runtime
    // boat so the return event can refill that exact root.
    this.#rootInstanceId = config?.instanceId || null;
    this.stats =
      statsConfig.statsByLevel[statsConfig.upgradeLevel] ||
      statsConfig.statsByLevel[1];
    this.zoneId = zoneId;
    this.velocity = new Vector2(0, 0);
    this.angle = -Math.PI / 2;
    this.energy = initialEnergy !== null ? initialEnergy : this.stats.maxEnergy;
    this.state = "idle";
    this.isBaitDropped = false;
    this.isFinished = false;
    this.hasLeftShore = false;
    this.remainingSections = statsConfig.sections || 1;
    this.waypoints = [];

    this.avoidanceState = "none";
    this.avoidanceTimer = 0;
    this.avoidanceTargetAngle = 0;
    this.engineThrottle = 1.0;
    this.persistenceTimer = 0;
    this.maneuverTimer = 0;
  }


  get sensorRays() {
    if (this.config.showSensors === false) return [];
    return this.#sensorRays;
  }

  get rootInstanceId() {
    return this.#rootInstanceId;
  }

  setTarget(targetX, targetY, zoneId = null, isReturn = false) {
    if (this.state === "drifting") return;

    const isManual = this.config.manualControl;

    if (!isManual && !isReturn && this.state === "deploying") {
      this.waypoints.push({ x: targetX, y: targetY, zoneId: zoneId });
      return;
    }

    this.target = new Vector2(targetX, targetY);
    if (zoneId !== null) this.zoneId = zoneId;
    this.state = isReturn ? "returning" : "deploying";
  }

  update(dt, checkPhysics, checkSensor, cellSize, env) {
    if (this.state === "idle" || this.isFinished) return;

    const dtSec = dt * 0.001;
    this.persistenceTimer = Math.max(0, this.persistenceTimer - dtSec);
    this.maneuverTimer = Math.max(0, this.maneuverTimer - dtSec);
    const isManual = this.config.manualControl;

    this.#updateEnergy(dtSec);

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

    if (this.#checkArrival(targetInfo, obstacles, isManual)) return;

    const steering = this.#calculateSteering(
      targetInfo,
      obstacles,
      isManual,
      dtSec,
    );
    this.#applyPhysics(steering, dtSec);
    this.#moveAndCollide(dtSec, checkPhysics, isManual);
    this.#checkShoreParking(isManual);
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

  #updateEnergy(dtSec) {
    const drainMult = this.state === "waiting" ? 0.5 : 1;
    if (this.state !== "drifting") {
      this.energy -= this.stats.energyDrainPerSec * drainMult * dtSec;
      if (this.energy <= 0) {
        this.energy = 0;
        this.state = "drifting";
      }
    }
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

  #calculateTargetInfo() {
    const target = this.state === "deploying" ? this.target : this.startPos;
    const dx = target.x - this.pos.x;
    const dy = target.y - this.pos.y;
    const distSq = dx * dx + dy * dy;
    return { dx, dy, distSq, dist: Math.sqrt(distSq) || 1 };
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

  #calculateSteering({ dx, dy, dist }, sensors, isManual, dtSec) {
    const slowRadius = Math.max(1, this.config.slowRadius || 150);
    const t = Math.min(dist / slowRadius, 1.0);
    const arrivalRatio = t * t;

    const isBlindZone = dist < sensors.lookDist * 1.5;

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
      (isForwardBlocked || this.persistenceTimer > 0) && !isParking;

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
      dist < slowRadius && this.avoidanceState === "none"
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

  #checkArrival({ dist }, { isForwardBlocked }, isManual) {
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
          if (this.zoneId && !this.isBaitDropped) {
            this.isBaitDropped = true;
            this.remainingSections--;
            return true;
          }

          if (this.isBaitDropped) return true;

          if (this.waypoints.length > 0) {
            this.#processNextWaypoint();
            return true;
          } else {
            this.zoneId = null;
            this.state = "returning";
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
      this.zoneId = wp.zoneId;
    } else {
      this.state = "returning";
    }
  }

  #applyPhysics(steering, dtSec) {
    const accel = this.config.acceleration || 400;
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


      const maxTurn = (this.config.turnSpeedRad || 3.0) * dtSec;
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

        const alignFactor = Math.max(0.3, alignment);

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

    lateralSpeed *= 0.05;

    this.velocity.x = noseX * forwardSpeed + rightX * lateralSpeed;
    this.velocity.y = noseY * forwardSpeed + rightY * lateralSpeed;

    if (steering.brake > 0) {
      const brakeFriction = Math.max(0, 1.0 - steering.brake * dtSec * 7);
      this.velocity.x *= brakeFriction;
      this.velocity.y *= brakeFriction;
    }

    this.velocity.x *= 0.97;
    this.velocity.y *= 0.97;

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
