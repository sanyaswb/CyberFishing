// ============================================================================
// FISHING GAME CONFIGURATION
// ============================================================================

const CONFIG = {
    // Canvas Settings
    canvas: {
        width: 800,
        height: 600,
        id: 'gameCanvas',
        backgroundColor: '#0f171e',
    },

    // Viewport Settings
    viewport: {
        marginLeft: 50,
        marginRight: 50,
        marginTop: 50,
        marginBottom: 50,
    },

    // Input Settings
    input: {
        pointerThreshold: 10, // Dead zone (so that random micro-movements don't jerk the rod)
        dragRadius: 100, // Swipe distance in pixels for maximum steering
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
        lineColor: '#4a5b6c',
        lineWidth: 1,
        baseX: null, // null = canvas center
        baseY: null, // null = canvas bottom
    },

    // Reel Settings
    reel: {
        level: 4,
        basePower: 1.0,
    },

    // Fish Settings
    fish: {
        level: 4,
        weight: 4,
        resistance: 1,
        edgePowerMultiplier: 1.0,
        behaviorTimerMin: 200,
        behaviorTimerRandom: 400, // Random range: min to min+random
        angleOffset: 0.5, // Offset in fishing direction (Y)
    },

    // Force Multipliers
    physics: {
        fishForceMultiplier: 0.01,
        playerForceMultiplier: 0.017,
        playerSteeringMultiplier: 1.5, // Mechanical advantage of rod for X-axis steering
    },

    // Tension Meter Settings
    tension: {
        // Calculation
        sensitivityMultiplier: 0.02,
        smoothApproach: 0.15,
        reelRecoveryMultiplier: 0.2,
        
        // Pulse effect
        pulseSpeedBaseMultiplier: 0.05,
        pulseSpeedMax: 10,
        pulseTensionDivisor: 10,
        pulseMagnitude: 0.5, // 0.5 + sin() * 0.5 = 0 to 1

        // Line breaking mechanic
        breakThreshold: 100, // Tension % at which timer starts
        breakTimeout: 1500, // Milliseconds in red zone before line breaks

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
    // Stamina / Fighting mechanics
    stamina: {
        fish: {
            baseStaminaMultiplier: 50,
            flatBonus: 500
        },
        mechanics: {
            slackThreshold: 25,
            optimalMax: 50,
            perfectTension: 65,
            baseDepletionRate: 45,
            baseRegenRate: 30
        ,
        centerSweetSpot: 0.2,
        edgeRegenRate: 150
        }
    },
};
