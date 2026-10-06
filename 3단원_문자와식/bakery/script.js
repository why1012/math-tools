document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const stageCounter = document.getElementById('stage-counter');
    const btnCheck = document.getElementById('btn-check');
    
    const leftPlate = document.getElementById('left-plate');
    const rightPlate = document.getElementById('right-plate');

    // Calculator Elements
    const calcScreen = document.getElementById('calc-screen');
    const numBtns = document.querySelectorAll('.num-btn');
    const btnClear = document.getElementById('btn-clear');
    const btnBack = document.getElementById('btn-back');
    const opBtns = document.querySelectorAll('.op-btn');

    const tutorialOverlay = document.getElementById('tutorial-overlay');
    const tutorialText = document.getElementById('tutorial-text');

    // State
    let leftSide = { x: 1, unit: 5 };
    let rightSide = { x: 0, unit: 8 }; 
    let actualXValue = 3;
    let currentCalcValue = '0';

    // Mission State
    let currentStage = 1;
    const MAX_STAGES = 7;
    let initialMissionState = null; 
    let isAutoGuiding = false;

    function init() {
        setupEventListeners();
        generateMission();
    }

    function setupEventListeners() {
        // Calculator Numbers
        numBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (currentCalcValue === '0') {
                    currentCalcValue = btn.textContent;
                } else if (currentCalcValue.length < 3) { // Max 3 digits
                    currentCalcValue += btn.textContent;
                }
                updateCalcScreen();
            });
        });

        // Calculator Utils
        btnClear.addEventListener('click', () => {
            currentCalcValue = '0';
            updateCalcScreen();
        });

        btnBack.addEventListener('click', () => {
            if (currentCalcValue.length > 1) {
                currentCalcValue = currentCalcValue.slice(0, -1);
            } else {
                currentCalcValue = '0';
            }
            updateCalcScreen();
        });

        // Calculator Operations
        opBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const op = btn.getAttribute('data-op');
                const val = parseInt(currentCalcValue);
                if (val > 0) {
                    performOperation(op, val);
                    currentCalcValue = '0';
                    updateCalcScreen();
                }
            });
        });

        // Answer Submission
        btnCheck.addEventListener('click', checkMission);
    }

    function updateCalcScreen() {
        calcScreen.textContent = currentCalcValue;
    }

    function generateMission() {
        if (currentStage > MAX_STAGES) {
            alert('🎉 제빵사의 7단계 미션을 모두 클리어했습니다! 정말 대단해요!');
            currentStage = 1;
        }

        stageCounter.textContent = `[ ${currentStage} / ${MAX_STAGES} ]`;
        currentCalcValue = '0';
        updateCalcScreen();

        actualXValue = Math.floor(Math.random() * 8) + 2; // 2 to 9
        const a = Math.floor(Math.random() * 3) + 1; // 1 to 3
        const b = Math.floor(Math.random() * 10) + 1; // 1 to 10
        const c = a * actualXValue + b;

        leftSide = { x: a, unit: b };
        rightSide = { x: 0, unit: c };
        
        initialMissionState = { a: a, b: b, c: c, xVal: actualXValue };
        renderScale(true);
    }

    function performOperation(op, val) {
        if (isAutoGuiding) return;
        let canPerform = true;
        
        switch (op) {
            case 'add':
                leftSide.unit += val; rightSide.unit += val; break;
            case 'subtract':
                if (leftSide.unit >= val && rightSide.unit >= val) {
                    leftSide.unit -= val; rightSide.unit -= val;
                } else {
                    alert('양변에서 뺄 수 있는 숫자(버터)가 부족합니다!'); canPerform = false;
                }
                break;
            case 'multiply':
                if ((leftSide.unit * val > 100) || (rightSide.unit * val > 100)) {
                     alert('숫자가 너무 커집니다!'); canPerform = false;
                } else {
                    leftSide.x *= val; leftSide.unit *= val; rightSide.x *= val; rightSide.unit *= val;
                }
                break;
            case 'divide':
                if (leftSide.x % val === 0 && leftSide.unit % val === 0 && rightSide.x % val === 0 && rightSide.unit % val === 0) {
                    leftSide.x /= val; leftSide.unit /= val; rightSide.x /= val; rightSide.unit /= val;
                } else {
                    alert(`현재 상태에서는 양변을 똑같이 ${val}로 나눌 수 없습니다!`); canPerform = false;
                }
                break;
        }
        
        if (canPerform) renderScale(true);
    }

    // --- State Management & Animated Rendering ---
    function calcIdealBlocks(state) {
        let blocks = [];
        for (let i = 0; i < state.x; i++) blocks.push({ type: 'x', value: 1 });
        // Single butter block for the total unit value
        if (state.unit > 0) {
            blocks.push({ type: 'unit', value: state.unit });
        }
        return blocks;
    }

    function updatePlateDOM(plateElement, idealBlocks, animate, animDuration = 600) {
        const currentElements = Array.from(plateElement.querySelectorAll('.dropped-item:not(.anim-leave)'));
        let toKeep = [], toAdd = [...idealBlocks], toRemove = [];

        currentElements.forEach(el => {
            const t = el.getAttribute('data-type');
            const v = parseInt(el.getAttribute('data-value'));
            const matchIndex = toAdd.findIndex(b => b.type === t && b.value === v);
            if (matchIndex !== -1) {
                toKeep.push(el); toAdd.splice(matchIndex, 1);
            } else {
                toRemove.push(el);
            }
        });

        toRemove.forEach(el => {
            if (animate) {
                el.style.animationDuration = animDuration + 'ms';
                el.classList.add('anim-leave');
                setTimeout(() => el.remove(), animDuration);
            } else el.remove();
        });

        toAdd.forEach(block => {
            const el = createItemElement(block.type, block.value);
            if (animate) {
                el.style.animationDuration = animDuration + 'ms';
                el.classList.add('anim-enter');
            }
            plateElement.appendChild(el);
        });
    }

    function createItemElement(type, value) {
        const div = document.createElement('div');
        div.className = 'dropped-item';
        div.setAttribute('data-type', type);
        div.setAttribute('data-value', value);
        const visual = document.createElement('div');
        visual.className = 'item-visual';
        if (type === 'x') {
            visual.classList.add('item-dough'); visual.innerHTML = '<span>x</span>';
        } else {
            visual.classList.add('item-butter');
            visual.innerHTML = `<span>${value}</span>`;
            // Dynamic scale based on value (min scale 0.8, max scale ~1.8)
            const scaleFactor = Math.min(1.8, 0.8 + (value * 0.015));
            visual.style.transform = `scale(${scaleFactor})`;
        }
        div.appendChild(visual); return div;
    }

    function renderScale(animate = true, animDuration = 600) {
        updatePlateDOM(leftPlate, calcIdealBlocks(leftSide), animate, animDuration);
        updatePlateDOM(rightPlate, calcIdealBlocks(rightSide), animate, animDuration);
        updateTilt();
    }

    function updateTilt() {
        const leftWeight = (leftSide.x * actualXValue) + leftSide.unit;
        const rightWeight = (rightSide.x * actualXValue) + rightSide.unit;
        let tiltAngle = 0;
        const weightDiff = rightWeight - leftWeight;
        if (weightDiff !== 0) tiltAngle = Math.max(-15, Math.min(15, weightDiff * 1.5));
        document.documentElement.style.setProperty('--tilt-angle', `${tiltAngle}deg`);
    }

    // --- Game Logic & Auto Guide ---
    function checkMission() {
        if(isAutoGuiding) return;
        const answer = parseInt(currentCalcValue);
        
        if (answer === actualXValue) {
            alert('🎉 정답입니다!');
            currentStage++;
            generateMission();
        } else {
            startAutoGuide();
        }
    }

    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    async function showPopup(text, duration = 4000) {
        tutorialText.innerHTML = text.replace(/\\n/g, '<br>');
        tutorialOverlay.classList.remove('hidden');
        await wait(duration);
        tutorialOverlay.classList.add('hidden');
        await wait(500); 
    }

    async function startAutoGuide() {
        isAutoGuiding = true;
        
        leftSide = { x: initialMissionState.a, unit: initialMissionState.b };
        rightSide = { x: 0, unit: initialMissionState.c };
        renderScale(true);
        await wait(1000);

        const b = initialMissionState.b;
        if (b > 0) {
            await showPopup(`x를 구하기 위해 먼저 양변에서 상수항을 제거해야 해요.\\n양변에서 <b>${b}</b>를 뺍니다!`, 4000);
            
            leftSide.unit -= b;
            rightSide.unit -= b;
            renderScale(true);
            await wait(1500);
        }

        const a = initialMissionState.a;
        if (a > 1) {
            await showPopup(`이제 x만 남기기 위해 양변을 x의 계수인 <b>${a}</b>로 똑같이 나눕니다!`, 4000);
            
            leftSide.x /= a;
            rightSide.unit /= a;
            renderScale(true);
            await wait(1500);
        }

        await showPopup(`정답은 <b>x = ${initialMissionState.xVal}</b> 입니다.\\n다음 문제로 넘어갑니다!`, 4000);
        
        isAutoGuiding = false;
        currentStage++;
        generateMission();
    }

    init();
});
