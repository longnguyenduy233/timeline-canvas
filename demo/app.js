// var items = [
//   {
//     startTime: "00:00:00",
//     endTime: "04:00:00",
//     color: "blue",
//   },
//   {
//     startTime: "12:05:00",
//     endTime: "20:45:00",
//     color: "green",
//   },
//   {
//     startTime: "08:00:00",
//     color: "red",
//   },
//   {
//     startTime: "02:00:00",
//     color: "red",
//   },
//   {
//     startTime: "02:30:00",
//     color: "red",
//   },
// ];
var groups = [
  {
    id: 1,
    height: 60,
    subgroup: [
      {
        id: 1,
        items: [
          {
            startTime: "00:00:00",
            endTime: "04:00:00",
            color: "#4F92D6",
          },
          {
            startTime: "12:05:00",
            endTime: "20:45:00",
            color: "#4F92D6",
          },
          {
            startTime: "08:30:00",
            color: "blue",
            id: 'second-item'
          },
          {
            startTime: "02:00:00",
            color: "blue",
          },
          {
            startTime: "02:30:00",
            color: "blue",
          },
        ],
      },
      {
        id: 2,
        items: [
          {
            startTime: "00:00:00",
            endTime: "04:00:00",
            color: "#92D050",
          },
          {
            startTime: "12:05:00",
            endTime: "20:45:00",
            color: "#92D050",
          },
          {
            startTime: "08:00:00",
            color: "red",
            id: 'first-item'
          },
          {
            startTime: "02:00:00",
            color: "red",
          },
          {
            startTime: "02:30:00",
            color: "red",
          },
        ],
      },
    ],
  },
];
var dependency = [
  {
    id: '1',
    firstItemId: 'first-item',
    secondItemId: 'second-item'
  }
];
// set others time zone as example below:
// var options = {
//   locale: 'en-US',
//   timeZone: 'America/New_York'
// };
var options = {};
var s = S$(null, groups, dependency, options);
