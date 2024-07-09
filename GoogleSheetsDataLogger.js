#!/usr/bin/node
'use strict';

require('dotenv').config(); //Load Env from file
const { google } = require('googleapis');
const sheets = google.sheets('v4');
const MAX_DATA_IN_RAM = 100000; //Max size of RAM cache in case of long term internet failure
const dayFraction = 86400000; // Milliseconds in a Day
const dateOffset = new Date(1899,11,30) - 3600000;  // Spreadsheet Epoc minus an hour
const GoogleAuth = new google.auth.GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/spreadsheets'
});

let auth = [];
auth.expiryDate = 0;
let internet_down = false;
//Store the measurments, sent to Google in batches
let measurmentArray = [];
//Interval that sends the batched data to Google
setInterval(AppendSpreadSheet, 1 * 60 * 1000); //Send data to Google
setInterval(TakeMeasurement, 5 * 1000); //Take a measurement of something

//Send the Data to Google Sheets, retain in memory if not sent
async function AppendSpreadSheet() {
   if (auth.expiryDate < Date.now()) {
    console.log('Getting New Google Credentials');
    auth = await GoogleAuth.getClient();
  }
  sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: 'Sheet1!A:C',  // Make Sure to change this to match # of Rows in datameasurments
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    resource: {
        values: measurmentArray,
      },
    auth: auth
  }, (err, result) => {
    if (err) {
        console.log('Append Threw: ' + err);
        console.log('Cacheing ' + measurmentArray.length + " Measurments with " + process.resourceUsage().maxRSS + ' kB RAM');
    } else if (!result.statusText === 'OK') {
        console.log('Google Says Not OK: ' + result);
        console.log('Cacheing ' + measurmentArray.length + " Measurments with " + process.resourceUsage().maxRSS + ' kB RAM');
    } else {
      measurmentArray = []; //If success clear out stored measurments
      internet_down = false;
    }
  });
}

function TakeMeasurement() {
  const curDate = new Date(); //Get the time of the datapoint
  //Push into measurement array for Google
  if (measurmentArray.length < MAX_DATA_IN_RAM) { //Stop caching in RAM if too many datapoints so we don't crash 
    measurmentArray.push([(curDate - dateOffset) / dayFraction, process.resourceUsage().maxRSS, process.cpuUsage().user ]); //Variables to save
  } else if (!internet_down) { //ony log on state change
    console.log('Dropping Measurments due to Max Data');
    internet_down = true;
  }
}
