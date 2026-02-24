const CONFIG = {
    canvas: {
        id: 'gameCanvas',
        backgroundColor: '#0f171e' // Цей колір потрібен класу Renderer
    },

    locations: {
        baseResolution: { width: 2560, height: 2560 },
        cellSize: 64,
        map: {
            test: {
                id: 'test',
                name: 'Test Waters',
                bgUrl: 'bg_test.png', // Шлях до твоєї картинки
                // x: 'left', 'center', 'right'
                // y: 'top', 'center', 'bottom', 'safeZone'
                initialAlignment: { x: 'center', y: 'center' }, 
                safeZone: { top: 0, bottom: 2560 }, 
                depthBounds: { min: 1.5, max: 15.0 },
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
                        // { x: 8, y: 10, w: 4, h: 3 }
                    ],
                    dynamic: [
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
                    ]
                }
            }
        }
    },

    ui: {
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
            height: 150,
            color: 'rgba(0, 150, 255, 0.5)'
        },

        line: {
            visible: true,
            color: 'rgba(255, 255, 255, 0.3)',
            width: 1
        }
    },

    debug: {
        overlay: false,
    },

    logs: {
        events: false,
        maxEntries: 50,
        endpoint: 'http://localhost:3000/api/events' // ОСЬ ЦЕЙ РЯДОК З'ЄДНУЄ ГРУ З БЕКЕНДОМ
    },

    // Input Settings
    input: {
        pointerThreshold: 10, // Dead zone (so that random micro-movements don't jerk the rod)
        dragRadius: 200, // Swipe distance in pixels for maximum steering
    },

    // Float/Bobber Settings
    float: {
        initialX: null, // null = canvas center
        initialY: null, // null = canvas center
        size: 15,
        circleRadius: 20,
        friction: 0.85,
        color: '#00ff80',
        circleColor: 'rgba(0, 255, 128, 0.2)',
    },

    // Rod Settings
    rod: {
        level: 5,
        basePower: 1.0,
        compensation: 0.8
    },

    // Reel Settings
    reel: {
        level: 4,
        basePower: 1.0,
    },

    // Hook Settings
    hook: {
        level: 5,
        weight: 4,
        quality: 1, // Аналог resistance у риби
    },

    // Hook Break / Escape Mechanics
    hookMechanics: {
        safeTensionThreshold: 50,
        baseEscapeChance: 0.01,
        chancePer10Tension: 0.01,
        fishDominanceMultiplier: 1.5,
        extremeDominanceBonus: 0.5,
        checkIntervalMs: 1000
    },

    // Fish Settings
    fish: {
        level: 4,
        weight: 4, // Affects base power and stamina
        resistance: 1, // Affects how much tension increases per unit of player input
        agility: 1.0, // Affects how quickly fish changes direction
        edgePowerMultiplier: 1.0, // How much stronger the fish gets near edges (1.0 = no change)
        bounceCooldownMs: 2000, // Minimum time between direction changes after hitting a wall
        dirChangeMinMs: 500, // Minimum time between random direction changes
        dirChangeMaxMs: 1500, // Maximum time between random direction changes
        behaviors: { // Defines different behavior states with their own pull/move multipliers and durations
            idle: { pull: 1, move: 0.0, minTime: 500, maxTime: 2000, weight: 50 },
            rest: { pull: 0.2, move: 0.1, minTime: 500, maxTime: 1500, weight: 10 },
            swim: { pull: 0.8, move: 1.0, minTime: 2000, maxTime: 4000, weight: 10 },
            dash: { pull: 1.5, move: 0.0, minTime: 500, maxTime: 1200, weight: 30 }
        }
    },

    // Force Multipliers
    physics: {
        fishForceMultiplier: 0.01,
        playerForceMultiplier: 0.017,
        playerSteeringMultiplier: 1.5, // Mechanical advantage of rod for X-axis steering
        edgePullPenalty: 0.5, // 0.5 означає, що на краю екрана гравець втратить 50% сили
    },

    // Tension Meter Settings
    tension: {
        // Calculation
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

    // Colors
    colors: {
        background: '#0f171e',
        bodyBackground: '#1a1a1a',
    },

    // Stamina & Exhaustion (Fighting mechanics)
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
