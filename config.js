const CONFIG = {
    canvas: {
        id: 'gameCanvas',
        backgroundColor: '#0f171e' // Цей колір потрібен класу Renderer
    },

    ui: {
        draggableButtons: true,
        dragHoldTimeMs: 1000,

        rod: {
            x: 'center',
            yOffset: 0
        },

        indicators: {
            x: 'center',
            y: 40,
            spacing: 40
        },

        catchZone: {
            color: 'rgba(0, 150, 255, 0.5)'
        },

        line: {
            visible: true,
            color: 'rgba(255, 255, 255, 0.3)',
            width: 1
        }
    },

    locations: {
        debugVisuals: true,       // Головний вимикач (якщо false - взагалі нічого не малюється)
        debugZones: true,         // Показувати кольорові квадрати (зелені, червоні)
        debugGrid: true,          // Показувати лінії сітки
        debugDepthText: false,     // Показувати цифри глибини
        debugOpacity: 0.8,
        baseResolution: { width: 2560, height: 2560 },
        designCellSize: 64,
        cellSize: 32,
        map: {
            test: {
                id: 'test',
                name: 'Test Waters',
                bgUrl: 'bg_test.webp',
                depthUrl: 'depth.jpg',
                // x: 'left', 'center', 'right'
                // y: 'top', 'center', 'bottom', 'safeZone'
                initialAlignment: { x: 'center', y: 'center' }, 
                safeZone: { top: 0, bottom: 2560 }, 
                depthBounds: { min: 1.5, max: 15.0 },

                weather: {
                    updateIntervalMs: 10000, 
                    chances: {
                        rain: 0.90, 
                        fog: 0.0  
                    }
                },

                zones: {
                    castable: [
                        { x: 0, y: 13, w: 40, h: 20 } 
                    ],
                    collisions: [
                        { x: 0, y: 0, w: 40, h: 13 },
                        { x: 0, y: 33, w: 40, h: 7},
                        { x: 0, y: 14, w: 6, h: 6},
                    ],
                    snags: [
                        { x: 15, y: 20, w: 11, h: 9 }
                    ],
                    // dynamic: [
                        // { 
                        //     id: 'fish_school_1', 
                        //     type: 'buff', 
                        //     multiplier: 1.5, 
                        //     x: 10, y: 15, w: 3, h: 3, 
                        //     moving: true, 
                        //     speedX: 1.2, 
                        //     speedY: 0.8, 
                        //     bounds: { x: 0, y: 5, w: 20, h: 14 }
                        // }
                    // ]
                }
            }
        }
    },

    spawns: {
        tickRateMs: 1000,
        antiSpam: {
            baseCooldownMs: 1500,
            penaltyStepMs: 1000,
            resetTimeMs: 8000
        },
        timePhases: {
            morning: { startHour: 4, endHour: 10 },
            day: { startHour: 10, endHour: 18 },
            evening: { startHour: 18, endHour: 23 },
            night: { startHour: 23, endHour: 4 }
        },
        fishes: [
            {
                id: 'crucian_stalker',
                name: 'Карась-сталкер',
                baseChance: 0.15, 
                maxHookSize: 6,

                weatherMultipliers: {
                    rain: 1.5,
                    fog: 1.2
                },
                
                depthConfig: {
                    minDepth: 1.0, 
                    maxDepth: 10.0,
                    minWeightAtMinDepth: 0.125,
                    maxWeightAtMinDepth: 0.800,
                    minWeightAtMaxDepth: 1.123,
                    maxWeightAtMaxDepth: 2.678,
                    chanceMultAtMaxDepth: 0.4 
                },
                
                weightConfig: {
                    rarityCurve: 3.5, 
                    maxLevel: 5,
                    baseResistance: 0.8,
                    maxResistance: 2.5
                },

                baitMultipliers: { 'oil_worm': 2.0, 'bread': 0.5 },
                timeMultipliers: { morning: 1.5, day: 0.8, evening: 1.2, night: 0.2 },
                dayMultipliers: { 1: 1.0, 2: 1.0, 3: 1.0, 4: 1.0, 5: 1.0, 6: 1.2, 0: 1.2 },

                physics: {
                    agility: 1.0,
                    edgePowerMultiplier: 1.0,
                    bounceCooldownMs: 2000,
                    dirChangeMinMs: 500,
                    dirChangeMaxMs: 1500,
                    lastDashTrigger: { targetState: 'lastDash', isLocked: false, chance: 0.50, checkIntervalMs: 1000 },
                    behaviors: {
                        idle: { pull: 0.8, move: 0.3, minTime: 500, maxTime: 2000, weight: 20 },
                        rest: { pull: 0.2, move: 0.1, minTime: 500, maxTime: 2500, weight: 10 },
                        swim: { pull: 1.0, move: 1.0, minTime: 2000, maxTime: 4000, weight: 50 },
                        dash: { pull: 1.5, move: 1.5, minTime: 1000, maxTime: 2200, weight: 20 },
                        lastDash: { pull: 1.5, move: 2.5, minTime: 1000, maxTime: 3000, weight: 0, dirChangeMinMs: 500, dirChangeMaxMs: 1000, agility: 1.5, edgePowerMultiplier: 1.2 }
                    }
                }
            },
            {
                id: 'perch_radioactive',
                name: 'Окунь-радіоактивний',
                baseChance: 0.20, 
                maxHookSize: 9,

                weatherMultipliers: {
                    rain: 1.1,
                    fog: 1.0
                },
                
                depthConfig: {
                    minDepth: 1.0, 
                    maxDepth: 10.0,
                    minWeightAtMinDepth: 0.125,
                    maxWeightAtMinDepth: 0.800,
                    minWeightAtMaxDepth: 1.123,
                    maxWeightAtMaxDepth: 1.678,
                    chanceMultAtMaxDepth: 0.4 
                },
                
                weightConfig: {
                    rarityCurve: 3.5, 
                    maxLevel: 5,
                    baseResistance: 0.8,
                    maxResistance: 1.5
                },

                baitMultipliers: { 'oil_worm': 2.0, 'bread': 0.5 },
                timeMultipliers: { morning: 1.5, day: 0.8, evening: 1.2, night: 0.2 },
                dayMultipliers: { 1: 1.0, 2: 1.0, 3: 1.0, 4: 1.0, 5: 1.0, 6: 1.2, 0: 1.2 },

                physics: {
                    agility: 1.3,
                    edgePowerMultiplier: 1.0,
                    bounceCooldownMs: 2000,
                    dirChangeMinMs: 500,
                    dirChangeMaxMs: 1500,
                    lastDashTrigger: { targetState: 'lastDash', isLocked: false, chance: 0.50, checkIntervalMs: 1000 },
                    behaviors: {
                        idle: { pull: 0.8, move: 0.8, minTime: 500, maxTime: 2000, weight: 10 },
                        rest: { pull: 0.5, move: 0.5, minTime: 500, maxTime: 2500, weight: 5 },
                        swim: { pull: 1.0, move: 1.5, minTime: 2000, maxTime: 4000, weight: 55 },
                        dash: { pull: 2.0, move: 2.2, minTime: 500, maxTime: 1200, weight: 30 },
                        lastDash: { pull: 1.5, move: 2.5, minTime: 500, maxTime: 1500, weight: 0, dirChangeMinMs: 500, dirChangeMaxMs: 1000, agility: 1.5, edgePowerMultiplier: 1.2 }
                    }
                }
            },
        ]
    },

    debug: {
        overlay: true,
    },

    logs: {
        events: false,
        maxEntries: 50,
        endpoint: 'http://localhost:3000/api/events' // ОСЬ ЦЕЙ РЯДОК З'ЄДНУЄ ГРУ З БЕКЕНДОМ
    },

    input: {
        pointerThreshold: 10, // Dead zone (so that random micro-movements don't jerk the rod)
        dragRadius: 200, // Swipe distance in pixels for maximum steering
    },

    float: {
        initialX: null, // null = canvas center
        initialY: null, // null = canvas center
        size: 15,
        circleRadius: 20,
        friction: 0.85,
        color: '#00ff80',
        circleColor: 'rgba(0, 255, 128, 0.2)',
    },

    rod: {
        level: 5,
        basePower: 1.0,
        compensation: 0.8
    },

    reel: {
        level: 4,
        basePower: 1.0,
    },

    net: {
        active: true,
        length: 15.0, // 150px How long the net pull lasts in seconds
        maxWeight: 3.0,
        quality: 1.0,
        type: 'all',
        chances: [
            { min: 0, max: 39, chance: 80 },
            { min: 40, max: 79, chance: 70 },
            { min: 80, max: 99, chance: 60 },
            { min: 100, max: Infinity, chance: 50 }
        ]
    },

    hook: {
        level: 5,
        weight: 4, // Affects how much tension increases per unit of player input
        quality: 1, // Аналог resistance у риби
    },

    hookMechanics: {
        safeTensionThreshold: 50,           // Поріг для сильної риби
        safeTensionThresholdWeakFish: 90,   // Поріг для слабкої риби (НОВЕ)
        baseEscapeChance: 0.01,
        chancePer10Tension: 0.01,
        fishDominanceMultiplier: 1.5,
        extremeDominanceBonus: 0.5,
        checkIntervalMs: 1000,
        slackLinePenaltyTimeMs: 10000,      // Час провисання до штрафу (10 сек) (НОВЕ)
        slackLineEscapeChance: 0.10         // Шанс сходу при провисанні (1%) (НОВЕ)
    },

    fish: {
        level: 4,
        weight: 4,
        resistance: 1,
        agility: 1.0,
        edgePowerMultiplier: 1.0,
        bounceCooldownMs: 2000,
        dirChangeMinMs: 500,
        dirChangeMaxMs: 1500,
        lastDashTrigger: {
            targetState: 'lastDash',
            isLocked: false,
            chance: 0.50,
            checkIntervalMs: 1000
        },
        behaviors: {
            idle: { pull: 0.0, move: 0.5, minTime: 500, maxTime: 2000, weight: 5 },
            rest: { pull: 0.2, move: 0.1, minTime: 500, maxTime: 2500, weight: 50 },
            swim: { pull: 0.0, move: 0.5, minTime: 2000, maxTime: 4000, weight: 35 },
            dash: { pull: 0.0, move: 1.2, minTime: 500, maxTime: 1200, weight: 10 },
            lastDash: { 
                pull: 0.6, 
                move: 2.5, 
                minTime: 1000, 
                maxTime: 3000, 
                weight: 0,
                dirChangeMinMs: 500,
                dirChangeMaxMs: 1000,
                agility: 1.5, // Increased agility during last dash
                edgePowerMultiplier: 1.2 // No extra edge power during last dash, but can be adjusted if needed
            }
        }
    },

    physics: {
        fishForceMultiplier: 0.01,
        playerForceMultiplier: 0.017,
        playerSteeringMultiplier: 1.5, // Mechanical advantage of rod for X-axis steering
        edgePullPenalty: 0.5, // 0.5 означає, що на краю екрана гравець втратить 50% сили
    },

    tension: {
        sensitivityMultiplier: 1.5, // How much player input affects tension
        smoothApproach: 0.15,
        reelRecoveryMultiplier: 0.2,
        
        // Pulse effect
        pulseSpeedBaseMultiplier: 0.05,
        pulseSpeedMax: 10,
        pulseTensionDivisor: 10,
        pulseMagnitude: 0.5, // 0.5 + sin() * 0.5 = 0 to 1

        // Line breaking mechanic
        // breakThreshold: 100, // Tension % at which timer starts
        // breakTimeout: 1500, // Milliseconds in red zone before line breaks

        breakThreshold: 100, 
        baseBreakTime: 1000, 
        timePerEquipmentLevel: 100,

        // Bar Display
        barWidth: 300,
        barHeight: 20,
        barYOffset: 40, // From bottom
        barBorderWidth: 1,
        borderPadding: 2,
        backgroundColor: '#1a2b3c',
        borderColor: '#4a5b6c',
        glowIntensity: 0.6,

        // Label
        labelFont: 'bold 12px monospace',
        labelColor: '#8a9bac',
        labelOffsetX: 60,
        labelOffsetY: 16,

        // Status Thresholds and Colors
        statuses: [
            { threshold: 0, label: 'Idle', color: '#4a5b6c' },
            { threshold: 1, label: 'LOW', color: '#00ccff' },
            { threshold: 30, label: 'MEDIUM', color: '#ffff00' },
            { threshold: 60, label: 'HIGH', color: '#ffaa00' },
            { threshold: 80, label: 'CRITICAL', color: '#ff4444' },
        ],

        // Color Gradient (Low to High Tension)
        colorGradient: {
            // 0-33%: Blue to Yellow
            low: { start: [0, 0, 255], end: [255, 255, 0] },
            // 33-66%: Yellow to Orange
            mid: { start: [255, 255, 0], end: [255, 128, 0] },
            // 66-100%: Orange to Red
            high: { start: [255, 128, 0], end: [255, 0, 0] },
            breakpoints: { low: 33, mid: 66 },
        },
    },

    colors: {
        background: '#0f171e',
        bodyBackground: '#1a1a1a',
    },

    stamina: {
        fish: {
            baseStaminaMultiplier: 50,
            flatBonus: 500
        },
        mechanics: {
            // Phase 1: Stamina
            slackThreshold: 25,
            optimalMax: 50, // Player fatigue threshold (0 damage to stamina)
            baseDepletionRate: 45,
            baseRegenRate: 30,
            centerSweetSpot: 0.2,
            edgeRegenRate: 150,
            
            // Phase 2: Exhaustion (When stamina = 0)
            exhaustionOptimalMax: 85, // Expanded tension limit for second phase
            basePowerDropPerSec: 0.1, // How much fish base power drops per 1 sec of exhaustion (0.1 base = 0.001 final)
            minBasePowerRatio: 0.2    // Fish cannot lose more than 80% of initial strength
        }
    },
};
