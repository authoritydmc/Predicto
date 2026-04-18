import { initWindowLogger } from "./logger.js";
export const IPL_TEAMS = [
 {
   code: "KKR",
   name: "Kolkata Knight Riders",
   color: "#3A225D",
   logo: "/assets/team-logos/Kolkata_Knight_Riders.svg"
 },
  {
    code: "RCB",
    name: "Royal Challengers Bangalore",
    color: "#EC1C24",
    logo: "/assets/team-logos/Royal_Challengers_Bengaluru.svg"
  },
  {
    code: "MI",
    name: "Mumbai Indians",
    color: "#004BA0",
    logo: "/assets/team-logos/Mumbai_Indians.svg"
  },
  {
    code: "CSK",
    name: "Chennai Super Kings",
    color: "#FDB913",
    logo: "/assets/team-logos/Chennai_Super_Kings.svg"
  },
  {
    code: "DC",
    name: "Delhi Capitals",
    color: "#004C93",
    logo: "/assets/team-logos/Delhi_Capitals.svg"
  },
  {
    code: "SRH",
    name: "Sunrisers Hyderabad",
    color: "#FF822A",
    logo: "/assets/team-logos/Sunrisers_Hyderabad.svg"
  },
  {
    code: "PBKS",
    name: "Punjab Kings",
    color: "#ED1B24",
    logo: "/assets/team-logos/Punjab_Kings.svg"
  },
  {
    code: "RR",
    name: "Rajasthan Royals",
    color: "#EA1A85",
    logo: "/assets/team-logos/Rajasthan_Royals.svg"
  },
  {
    code: "GT",
    name: "Gujarat Titans",
    color: "#1C2E4A",
    logo: "/assets/team-logos/Gujarat_Titans.svg"
  },
  {
    code: "LSG",
    name: "Lucknow Super Giants",
    color: "#1CA9C9",
    logo: "/assets/team-logos/Lucknow_Super_Giants.svg"
  }
];


initWindowLogger("Teams");

export const getTeamByCode = (code) => {
    console.log('finding logo for'+code);
    return IPL_TEAMS.find(
    team => team.code.toLowerCase() === code?.toLowerCase()
  );
};