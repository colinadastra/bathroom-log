const MAX_WAIT = 50; // 5 seconds
var form = FormApp.getActiveForm();
var bathroomChoiceItem = form.getItemById(555754957);
var spreadsheet = SpreadsheetApp.openById(form.getDestinationId());
var choiceSheet = spreadsheet.setActiveSheet(spreadsheet.getSheetByName("Current Choices"));
var occupiedSheet = spreadsheet.setActiveSheet(spreadsheet.getSheetByName("Occupied"));
var attemptSheet = spreadsheet.setActiveSheet(spreadsheet.getSheetByName("User Attempts"));
var maxRows = attemptSheet.getMaxRows();

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle("“47” Bathroom Log (Beta)")
    .setFaviconUrl("https://www.47aslhs.net/favicon.ico")
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function processForm(event) {
  var response = event.response;
  (response.getResponseForItem(form.getItemById(1583203527)).getResponse() == "Signing Out (going to bathroom)") ? signingOut(response) : signingIn(response);
  SpreadsheetApp.flush();
  // Update the list of choices available on the form for the next user
  updateChoices();
}

function updateChoices() {
  spreadsheet.setActiveSheet(choiceSheet);
  try {
    var choicesColumn = choiceSheet.getRange(1,1,choiceSheet.getLastRow(),1).getDisplayValues();
  } catch (err) {
  }
  var choices = [];
  for (var i = 0; choicesColumn != undefined && i < choicesColumn.length; i++) {
    choices.push(choicesColumn[i][0]);
  }
  bathroomChoiceItem.asMultipleChoiceItem().setChoiceValues(choices);
}

function signingOut(response) {
  var bathroomChoice = response.getResponseForItem(bathroomChoiceItem).getResponse();
  var user = response.getRespondentEmail();
  spreadsheet.setActiveSheet(occupiedSheet);
  var foundRange = occupiedSheet.createTextFinder(user).findNext();
  // If the user already has a reserved bathroom, alert them
  if (foundRange != null) {
    spreadsheet.setActiveSheet(attemptSheet).insertRowAfter(1).setActiveRange(spreadsheet.getRange("A2:C2")).setValues([[response.getTimestamp().valueOf(),user,"EXISTING_SIGNOUT"]]);
    return;
  }
  spreadsheet.setActiveSheet(choiceSheet);
  foundRange = choiceSheet.createTextFinder(bathroomChoice).findNext();
  // If the bathroom has already disappeared by the time of the form response, alert the user
  if (foundRange == null) {
    spreadsheet.setActiveSheet(attemptSheet).insertRowAfter(1).setActiveRange(spreadsheet.getRange("A2:C2")).setValues([[response.getTimestamp().valueOf(),user,"ALREADY_RESERVED"]]);
    return;
  }
  // Otherwise, remove the bathroom from the list of available bathrooms
  else {
    foundRange.deleteCells(SpreadsheetApp.Dimension.ROWS)
    spreadsheet.setActiveSheet(occupiedSheet);
    foundRange = occupiedSheet.createTextFinder(bathroomChoice).findNext();
    occupiedSheet.getRange(foundRange.getRow(), 2).setValue(response.getRespondentEmail());
    spreadsheet.setActiveSheet(attemptSheet).insertRowAfter(1).setActiveRange(spreadsheet.getRange("A2:C2")).setValues([[response.getTimestamp().valueOf(),user,"CLEAR_SIGNOUT " + bathroomChoice]]);
  }
}

function signingIn(response) {
  var user = response.getRespondentEmail();
  spreadsheet.setActiveSheet(occupiedSheet);
  var foundRange = occupiedSheet.createTextFinder(user).findNext();
  // If the user's email address is not in the "Occupied" spreadsheet, alert them
  if (foundRange == null) {
    spreadsheet.setActiveSheet(attemptSheet).insertRowAfter(1).setActiveRange(spreadsheet.getRange("A2:C2")).setValues([[response.getTimestamp().valueOf(),user,"NO_SIGNOUT"]]);
    return;
  }
  // Otherwise, remove their email address from the "Occupied" spreadsheet
  else {
    while (foundRange != null) {
      foundRange.clearContent();
      var bathroom = occupiedSheet.getRange(foundRange.getRow(), 1).getValue();
      spreadsheet.setActiveSheet(choiceSheet);
      choiceSheet.getRange(choiceSheet.getLastRow() + 1, 1).setValue(bathroom);
      choiceSheet.sort(1);
      foundRange = occupiedSheet.createTextFinder(user).findNext();
    }    
    spreadsheet.setActiveSheet(attemptSheet).insertRowAfter(1).setActiveRange(spreadsheet.getRange("A2:C2")).setValues([[response.getTimestamp().valueOf(),user,"CLEAR_SIGNIN"]]);
  }
}

function validateResponse(date) {
  spreadsheet.setActiveSheet(attemptSheet);
  var waitNumber = 0;
  while (attemptSheet.getMaxRows() <= maxRows && waitNumber < MAX_WAIT) {
    Utilities.sleep(100);
    waitNumber++;
  }
  var userAttempts = attemptSheet.getRange(2, 1, Math.min(attemptSheet.getMaxRows()-1,5), 3).getValues();
  var minTimeDifferenceIndex = -1; // Default is no match
  var minTimeDifference = MAX_WAIT * 100; // 5 seconds maximum difference allowed
  for (var row = 0; row < userAttempts.length; row++) {
    if (Math.abs(Number(userAttempts[row][0]) - date) < minTimeDifference) {
      minTimeDifference = Math.abs(Number(userAttempts[row][0]) - date);
      minTimeDifferenceIndex = row;
    }
  }
  maxRows = attemptSheet.getMaxRows();
  if (minTimeDifferenceIndex >= 0) {
    return userAttempts[minTimeDifferenceIndex][2];
  } else return "CLEAR";
}

function closeForm() {
  form.setAcceptingResponses(false);
  resetForm();  
}

function openForm() {
  form.setAcceptingResponses(true);
  resetForm();
}

function resetForm() {
  spreadsheet.setActiveSheet(choiceSheet);
  while (choiceSheet.getMaxRows() < 6) {
    choiceSheet.insertRows(1);
  }
  choiceSheet.getRange("A1:A2").setValues([["3rd Floor Boys'"],["3rd Floor Girls'"]]);
  spreadsheet.setActiveSheet(occupiedSheet).getRange("B1:B2").clear();
  updateChoices();
}