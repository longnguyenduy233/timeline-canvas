var items = [
  {
    startTime: '00:00:00',
    endTime: '04:00:00',
    color: 'blue'
  },
  {
    startTime: '12:05:00',
    endTime: '20:45:00',
    color: 'green'
  },
  {
    startTime: '08:00:00',
    color: 'red'
  },
  {
    startTime: '02:00:00',
    color: 'red'
  },
  {
    startTime: '02:30:00',
    color: 'red'
  }
];
// set others time zone as example below: 
// var options = {
//   locale: 'en-US',
//   timeZone: 'America/New_York'
// };
var options = {};
var s = S$(items, options);
