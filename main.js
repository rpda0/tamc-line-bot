const TOKEN = '';
const GROUP_ID_TO_NAME = {
  '': '視程',
  '': '黒点'
}
const NAME_TO_LINE_TOKEN = {
  '視程': '',
  '黒点': ''
}
const isNotify = true

function sendMsg(msg, reply, group) {
  if (isNotify) {
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Bearer ' + NAME_TO_LINE_TOKEN[GROUP_ID_TO_NAME[group]]
    };
    const data = {
      'message': '\n' + msg,
      'notificationDisabled': 'false'
    };
    UrlFetchApp.fetch('https://notify-api.line.me/api/notify', {'method': 'post', 'headers': headers, 'payload': data})
  } else {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + TOKEN
    };
    const data = {
      'to': group,
      'replyToken': reply,
      'messages': [{
        'type': 'text',
        'text': msg
      }]
    };
    UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {'headers': headers, 'payload': JSON.stringify(data)});
  }
}

function isChat(e) {
  e = e['events'][0]['message']['text'];
  if (e.split('\n').length < 3) return true
  const weekdays = ['月', '火', '水', '木', '金', '土', '日'];
  weekdays.forEach(w => {
    e = e.replaceAll(w, 'weekday')
  });
  e = e.replace('（', '(').replace('）', ')')
  Logger.log(e)
  if (e.includes('(weekday)')) return false
  return true
}

function parseText(q, mode) {
  q = q.replace('　', ' ').replace(' ', '').replace(/[Ａ-Ｚ０-９：]/g, function (s) {
    return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
  })
  if (mode == '視程') {
    var obTime = '';
    var observer = '';
    var weather = '';
    var visibility = 0;
    isFujisan = true;
    q.split('\n').forEach(v => {
      if (v.includes(':')) {
        obTime = v.match(/\d*:\d*/g)[0];
        weather = v.replace(/\d*:\d*/g, '');
      } else if (v.includes('富士山')) {
        var a = v.split('富士山');
        const base = '①'.charCodeAt(0);
        visibility = a[0].charCodeAt(0) - base + 1;
        x = ['×', 'x', '☓', '✕'];
        x.forEach(v => {
          if (a[1].includes(v)) isFujisan = false;
        })
      } else {
        observer = v;
      }
    });
    return [obTime, weather, observer, isFujisan, visibility]
  } else if (mode == '黒点') {
    sunspots = 0;
    q.split('\n').forEach(v => {
      if (v.includes('R')) sunspots = v.match(/\d+/g)[0];
      else if (v.includes('不可')) sunspots = '観測不可';
      else observer = v;
    })
    return [observer, sunspots, null, null];
  } else {
    return [q, null, null, null];
  }
}

function appendToSheet(e) {
  var sheetName = GROUP_ID_TO_NAME[e['events'][0]['source']['groupId']];
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const sentUser = JSON.parse(UrlFetchApp.fetch('https://api.line.me/v2/bot/group/' + e['events'][0]['source']['groupId'] + '/member/' + e['events'][0]['source']['userId'], {'headers': {'Authorization': 'Bearer ' + TOKEN}}).getContentText())['displayName'];
  const sentDate = new Date(e['events'][0]['timestamp']).toLocaleDateString();
  const content = parseText(e['events'][0]['message']['text'], sheetName);
  sheet.appendRow([sentDate, sentUser, content[0], content[1], content[2], content[3], content[4]]);
  return [content[0], content[1], content[2], content[3], content[4], sheetName]
}

function doPost(e) {
  e = e.postData.contents
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("ログ");
  var now = new Date();
  var time = now.toLocaleTimeString()
  sheet.appendRow([now.toDateString(), time.slice(0, time.indexOf(':') + 3), e]);
  e = JSON.parse(e);
  if (e['events'][0]['type'] == 'message' && e['events'][0]['source']['type'] == 'group') {
    Logger.log(isChat(e))
    if (isChat(e)) return
    contents = appendToSheet(e)
    if (contents[5] == '視程')
      msg = '以下の結果を記録しました\n観測時間:' + contents[0] + '\n天気:' + contents[1] + '\n観測者:' + contents[2] + '\n富士山:' + contents[3] + '\n視程目標:' + contents[4]
    else if (contents[5] == '黒点')
      msg = '以下の結果を記録しました\n観測者:' + contents[0] + '\n黒点相対数:' + contents[1]
    else
      msg = contents[0]
    sendMsg(msg, e['events'][0]['replyToken'], e['events'][0]['source']['groupId'])
  }
}
