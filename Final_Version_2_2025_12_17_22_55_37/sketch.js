let faceMesh, video, faces = [];
let newsItems = [];
let offsetsX = [], offsetsY = [], t = 0; 

let bgMusic, currentVol = 0;

let showIntro = true;         
let opacity = 0;              
let fadeState = 0;            
let currentIdx = 0;           
let blinkLock = false;        

let url = 'https://api.nytimes.com/svc/mostpopular/v2/viewed/7.json?api-key=5HA6uTZWBmhb4QpOcgufnAhMave8KbecKmx5Xq1W6yHAbbB5';

function preload() {
  faceMesh = ml5.faceMesh({ maxFaces: 1, refineLandmarks: false, flipped: false });
  soundFormats('mp3');
  // 确保文件名正确，不要有空格
  bgMusic = loadSound('Audio 1.mp3'); 
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  
  // --- 尝试强制自动播放 ---
  // 这里不再等待点击，直接尝试启动音频上下文
  getAudioContext().resume(); 
  
  if (bgMusic) { 
    bgMusic.setVolume(0); // 先静音
    bgMusic.loop();       // 尝试循环播放
  }
  // -----------------------

  loadJSON(url, gotData);
  
  video = createCapture(VIDEO);
  video.size(640, 480); // 降低分辨率以保证流畅度
  video.hide();
  
  faceMesh.detectStart(video, results => faces = results);
  textAlign(LEFT, TOP);
}

function draw() {
  background(0);

  // --- 音量控制逻辑 ---
  // 只要检测到人脸，音量目标就是 1，否则是 0
  let targetVol = (faces.length > 0) ? 1.0 : 0.0;
  
  // 平滑过渡音量
  currentVol = lerp(currentVol, targetVol, 0.05);
  
  if (bgMusic) {
    // 再次尝试唤醒：有些浏览器需要在第一帧唤醒
    if (getAudioContext().state !== 'running') {
      getAudioContext().resume();
    }
    bgMusic.setVolume(currentVol);
  }
  // -------------------

  // 数据保护：如果没有新闻数据，显示 Loading
  if (newsItems.length === 0) {
    fill(255); textAlign(CENTER); textSize(20);
    text("Loading Data...", width/2, height/2);
    return; 
  }

  if (faces.length > 0) {
    let face = faces[0];
    let nose = face.keypoints[1];
    
    // 映射坐标
    let x = map(nose.x, 0, video.width, width, 0) + 60;
    let y = map(nose.y, 0, video.height, 0, height) - 200; 

    let isBlinking = checkAnyEyeBlink(face);

    if (showIntro) {
      drawIntro(x, y);

      if (isBlinking && !blinkLock) {
        showIntro = false;  
        opacity = 0;       
        fadeState = 1;      
        currentIdx = 0;     
      }

    } else {
      handleFadeAnimation();

      if (fadeState === 0 && isBlinking && !blinkLock) {
        fadeState = -1; 
      }
      
      opacity = constrain(opacity, 0, 255);
      
      // 数据保护
      if(newsItems[currentIdx]) {
        drawCard(newsItems[currentIdx], x, y, opacity);
      }
    }

    blinkLock = isBlinking;

  } else {
    // 没人脸时
    showIntro = true;
    fadeState = 0;
    opacity = 255;
    blinkLock = false;
    
    drawFloatingBackground();
  }

  t += 0.005; 
}

function handleFadeAnimation() {
  const speed = 20; 
  if (fadeState === -1) { 
    opacity -= speed;
    if (opacity <= 0) {
      currentIdx = (currentIdx + 1) % newsItems.length;
      fadeState = 1; 
    }
  } else if (fadeState === 1) { 
    opacity += speed;
    if (opacity >= 255) {
      fadeState = 0; 
    }
  }
}

function checkAnyEyeBlink(face) {
  function getEAR(p1, p2, p3, p4) {
    let h = dist(face.keypoints[p1].x, face.keypoints[p1].y, face.keypoints[p2].x, face.keypoints[p2].y);
    let w = dist(face.keypoints[p3].x, face.keypoints[p3].y, face.keypoints[p4].x, face.keypoints[p4].y);
    return h / w;
  }
  let right = getEAR(159, 145, 33, 133);
  let left = getEAR(386, 374, 362, 263);
  return (right < 0.2 || left < 0.2);
}

function drawIntro(x, y) {
  push();
  textFont('Helvetica Light'); 
  textStyle(NORMAL);
  textSize(24);
  textAlign(LEFT, CENTER);
  let alpha = map(sin(frameCount * 0.1), -1, 1, 100, 255);
  fill(255, alpha); 
  text("Blink your eyes", x, y);
  pop();
}

function drawCard(item, x, y, alphaVal) {
  if (!item) return;

  let w = 300, curY = y;
  
  if (item.img) {
    let h = (w / item.img.width) * item.img.height;
    tint(255, alphaVal);
    image(item.img, x, curY, w, h);
    noTint();
    curY += h + 15;
  }

  textFont('Georgia'); 
  fill(255, alphaVal); textSize(20); textStyle(BOLD);
  text(item.title, x, curY, w);
  
  curY += (ceil(textWidth(item.title)/w) + 1) * 24 + 5;
  
  fill(200, alphaVal); textSize(14); textStyle(NORMAL);
  text(item.abstract, x, curY, w);
}

function drawFloatingBackground() {
  for (let i = 0; i < newsItems.length; i++) {
    let x = map(noise(offsetsX[i] + t), 0, 1, 20, width - 320);
    let y = map(noise(offsetsY[i] + t), 0, 1, -50, height - 400);
    drawCard(newsItems[i], x, y, 255);
  }
}

function gotData(data) {
  if (!data.results) return;
  for (let r of data.results) {
    let img = null;
    if (r.media?.[0]?.['media-metadata']) {
      let meta = r.media[0]['media-metadata'];
      img = loadImage(meta[meta.length-1].url);
    }
    newsItems.push({ title: r.title, abstract: r.abstract, img: img });
    offsetsX.push(random(1000)); offsetsY.push(random(1000));
  }
}