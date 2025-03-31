// add to app scripts, name & save. deploy as web app, execute as: me, who has access: anyone
function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tabName = e.parameter.tab;
  var sheet;

  // Use specified tab or default to first sheet
  if (tabName) {
    sheet = ss.getSheetByName(tabName);
  }

  if (!sheet) {
    sheet = ss.getSheets()[0]; // Default to first sheet if tab not found
  }

  // Get data from the sheet
  var data = sheet.getDataRange().getValues();
  var headers = data.shift();
  var jsonData = data.map(function (row) {
    var obj = {};
    headers.forEach(function (header, index) {
      obj[header] = row[index];
    });
    return obj;
  });

  return ContentService.createTextOutput(JSON.stringify(jsonData))
    .setMimeType(ContentService.MimeType.JSON);
}