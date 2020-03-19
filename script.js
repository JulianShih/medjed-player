let view = {
  video: null,
  current: null,
  progress: null,
  seekbar: null,
  cursor: null,
  pin: null,
  playPause: null,
  stepBackward: null,
  stepForward: null,
  screenshot: null
}

const mediaError = { // See https://developer.mozilla.org/en-US/docs/Web/API/MediaError
  MEDIA_ERR_ABORTED: 1,
  MEDIA_ERR_NETWORK: 2,
  MEDIA_ERR_DECODE: 3,
  MEDIA_ERR_SRC_NOT_SUPPORTED: 4
}

let intervalId
let cursorTime
let isSeeking = false
const fps = 25
const tolerantRange = 15

let xhr = new XMLHttpRequest()

const initializeElements = () => {
  view.video = document.getElementById('video')
  view.current = document.getElementById('current')
  view.progress = document.getElementById('progress')
  view.seekbar = document.getElementById('seekbar')
  view.pin = document.getElementById('pin')
  view.cursor = document.getElementById('cursor-time')
  view.playPause = document.getElementById('play-pause')
  view.stepBackward = document.getElementById('step-backward')
  view.stepForward = document.getElementById('step-forward')
  view.screenshot = document.getElementById('screenshot')
}

// region time display
const updateTime = () => {
  view.current.innerText = getTimeStamp(view.video.currentTime)
  const percentage = ((view.video.currentTime / view.video.duration) * 100)
  view.progress.innerText = Math.round(percentage).toString()
  view.seekbar.value = percentage.toFixed(3)
}

const showCursorTime = event => {
  // count cursor's X position relative to seekbar
  let cursorX = event.clientX - view.seekbar.getBoundingClientRect().left
  // count cursor time in ratio
  cursorTime = cursorX / (view.seekbar.offsetWidth - 1) * view.video.duration
  // set limit
  if (cursorTime < 0) {
    cursorTime = 0.0
  }
  if (cursorTime > view.video.duration) {
    cursorTime = view.video.duration
  }
  // show nothing if thumb dragged outside the tolerant range
  const cursorExceedsLeftEdge = cursorX < -tolerantRange
  const cursorExceedsRightEdge = cursorX > (view.seekbar.offsetWidth + tolerantRange)
  if (cursorExceedsLeftEdge || cursorExceedsRightEdge) {
    view.cursor.innerHTML = ''
  } else {
    view.cursor.innerHTML = getTimeStamp(cursorTime)
    view.cursor.style.left = cursorX + 'px'
    view.pin.style.left = cursorX + 'px'
  }
}

/**
 * Get natural time stamp of time.
 * @param {number} t - Time represent in float seconds.
 * @returns {string} - The natural time stamp represent in '00:00:00.000'.
 */
const getTimeStamp = t => {
  const time = t.toFixed(3)
  const hour = Math.floor(time / 3600).toString().padStart(2, '0')
  const min = Math.floor(time / 60).toString().padStart(2, '0')
  const sec = Math.floor(time - (hour * 3600 + min * 60)).toString().padStart(2, '0')
  const ms = (time - Math.floor(time)).toFixed(3).substr(2).padStart(3, '0')
  return hour + ':' + min + ':' + sec + '.' + ms
}
// endregion

// region url handling
const toggleSubmitButtonIfEmpty = () => {
  document.getElementById('submit').disabled = !(document.getElementById('url').value)
}

const submitUrl = () => {
  const urlString = document.getElementById('url').value
  if (!validateUrl(urlString)) {
    const message = '! mp4 url invalid !<br/>' +
      '！mp4網址格式錯誤！<br/><br/>' +
      'please enter an mp4 url<br/>' +
      '請輸入正確的網址格式'
    document.getElementById('message').innerHTML = message
    document.getElementById('error').style.display = 'block'
  } else {
    loadVideoInfo(urlString)
    document.getElementById('input-container').style.display = 'none'
    document.getElementById('player-container').style.display = 'block'
  }
}

/**
 * Validate User's input url.
 * @param {string} urlString - User input url.
 * @returns {boolean} - Indicates whether the url is valid.
 */
const validateUrl = urlString => {
  let url
  // catch invalid exception
  try {
    url = new URL(urlString.toLowerCase())
  } catch (exception) {
    console.log(exception)
    return false
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false
  }
  if (!url.pathname.endsWith('.mp4') || url.pathname.endsWith('/.mp4')) {
    return false
  }
  // invalid hostname
  if (url.hostname.length > 255 || url.hostname.includes('..')) {
    return false
  }
  if (url.hostname.includes('%') || url.hostname.includes('+')) {
    return false
  }
  return !(url.hostname.split('.').some(label => label.length > 63 || label.startsWith('-') || label.endsWith('-')))
}

const resetInput = () => {
  document.getElementById('url').value = ''
  document.getElementById('submit').disabled = true
  retryInput()
}

const retryInput = () => {
  document.getElementById('error').style.display = 'none'
  document.getElementById('player-container').style.display = 'none'
  document.getElementById('input-container').style.display = 'block'
}

const backToInput = () => {
  resetVideo()
  resetInput()
}
// endregion

// region load video
const loadVideoInfo = urlString => {
  initializeElements()
  view.video.src = urlString
  xhr.open('GET', urlString)
  xhr.send()
  const parsed = urlString.split('/')
  document.getElementById('info').innerText = parsed[parsed.length - 1]
  document.getElementById('duration').innerText = '23:59:59.999'
  view.seekbar.value = '0'
}

const setDuration = () => {
  document.getElementById('duration').innerText = getTimeStamp(view.video.duration)
}

const loadError = () => {
  let message
  switch (view.video.error.code) {
    case mediaError.MEDIA_ERR_ABORTED:
      break
    case mediaError.MEDIA_ERR_NETWORK:
      message = '! failed to fetch mp4 file !<br/>' +
        '！mp4讀取失敗！<br/><br/>' +
        'please check your network status<br/>' +
        '請檢查連線狀態'
      document.getElementById('message').innerHTML = message
      document.getElementById('error').style.display = 'block'
      break
    case mediaError.MEDIA_ERR_DECODE:
      message = '! failed to decode mp4 file !<br/>' +
        '！mp4解碼失敗！<br/><br/>' +
        'please check your mp4 source<br/>' +
        '請檢查影片來源'
      document.getElementById('message').innerHTML = message
      document.getElementById('error').style.display = 'block'
      break
    case mediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      if (xhr.status === 404) {
        message = '! mp4 file not found !<br/>' +
          '！找不到mp4！<br/><br/>' +
          'please check your mp4 url<br/>' +
          '請檢查影片網址'
      } else if (xhr.status === 403) {
        message = '! mp4 file access denied !<br/>' +
          '！沒有權限讀取mp4！<br/><br/>' +
          'please check your permission<br/>' +
          '請檢查權限'
      } else {
        message = '! mp4 file not supported !<br/>' +
          '！不支援的mp4！<br/><br/>' +
          'please check your mp4 source<br/>' +
          '請檢查影片來源'
      }
      document.getElementById('message').innerHTML = message
      document.getElementById('error').style.display = 'block'
      break
    default:
      message = '! unknown error !<br/>' +
        '！不知名錯誤！<br/><br/>' +
        'please try again<br/>' +
        '請再試一次'
      document.getElementById('message').innerHTML = message
      document.getElementById('error').style.display = 'block'
      break
  }
}

const resetVideo = () => {
  pauseVideo()
  view.video.currentTime = 0.0
  view.current.innerText = '00:00:00.000'
  view.progress.innerText = '0'
  view.seekbar.value = '0'
  view.video.playbackRate = 1
  isSeeking = false
  document.getElementById('speed-switch').innerText = '1x'
  if (document.fullscreenElement) {
    document.exitFullscreen()
    document.getElementById('fullscreen').innerText = '⇲'
  }
}
// endregion

// region video controls
const playVideo = () => {
  view.video.play()
  try {
    intervalId = window.setInterval(updateTime, 1000 / fps)
  } catch (exception) {
    console.log(exception)
  }
  view.playPause.innerText = '▐▐'
  view.stepBackward.disabled = true
  view.stepForward.disabled = true
  view.screenshot.disabled = true
}

const pauseVideo = () => {
  clearInterval(intervalId)
  view.video.pause()
  view.playPause.innerText = '▶'
  view.stepBackward.disabled = false
  view.stepForward.disabled = false
  view.screenshot.disabled = false
}

const playOrPause = () => {
  if (!view.video.paused) {
    pauseVideo()
  } else {
    playVideo()
  }
}

const changeSpeedToHalf = () => {
  view.video.playbackRate = 0.5
  document.getElementById('speed-switch').innerText = '0.5x'
}

const changeSpeedToNormal = () => {
  view.video.playbackRate = 1
  document.getElementById('speed-switch').innerText = '1x'
}

const changeSpeedToTwice = () => {
  view.video.playbackRate = 2
  document.getElementById('speed-switch').innerText = '2x'
}

const changeSpeedToFour = () => {
  view.video.playbackRate = 4
  document.getElementById('speed-switch').innerText = '4x'
}

const stepForward = () => {
}

const stepBackward = () => {
}

const startSeeking = () => {
  if (!view.video.paused) {
    pauseVideo()
    isSeeking = true
  }
}

const seek = () => {
  if (isNaN(cursorTime)) {
    cursorTime = 0.0
  }
  view.video.currentTime = cursorTime
  updateTime()
}

const endSeeking = () => {
  if (isSeeking && view.video.paused) {
    playVideo()
    isSeeking = false
  }
  view.video.currentTime = cursorTime
  updateTime()
}

const toggleFullscreen = () => {
  if (document.fullscreenElement) {
    document.exitFullscreen()
    document.getElementById('fullscreen').innerText = '⇲'
  } else {
    document.getElementById('video-container').requestFullscreen()
    document.getElementById('fullscreen').innerText = '⇱'
  }
}

const screenshot = () => {
  const canvas = document.getElementById('canvas')
  const download = document.getElementById('download')
  canvas.width = view.video.videoWidth
  canvas.height = view.video.videoHeight
  let image = canvas.getContext('2d')
  image.fillRect(0, 0, view.video.videoWidth, view.video.videoHeight)
  image.drawImage(view.video, 0, 0, view.video.videoWidth, view.video.videoHeight)
  download.href = canvas.toDataURL('image/png')
  download.download = new Date().toDateString() + '.png'
  download.click()
}
// endregion
