const udp = require("dgram");

const discoveryPort = 42069;
window.discovered = new Map();

var deviceNameInput = document.getElementById("device-name");
var searchButton = document.getElementById("search-button");
function setDeviceName(name) {
  localStorage.setItem("deviceName", name);
}
function getDeviceName() {
  let deviceName = localStorage.getItem("deviceName") || "";
  deviceNameInput.value = deviceName;

  return deviceName || "default";
}

getDeviceName();

var server = udp.createSocket("udp4");
server.bind(discoveryPort);
server.on("error", (err) => {
  console.log(`Server error:\n${err.stack}`);
  server.close();
});

function sendDiscovery(requestDiscovery, addrses) {
  let sendObj = {
    name: getDeviceName(),
    requestDiscovery: requestDiscovery,
  };
  console.log(`Sending discovery:\n${JSON.stringify(sendObj)}`);

  let sendStr = JSON.stringify(sendObj);

  if (requestDiscovery) {
    server.setBroadcast(true);
    server.send(sendStr, discoveryPort);
  } else {
    server.setBroadcast(false);
    server.send(sendStr, discoveryPort, addrses);
  }
}

deviceNameInput.onchange = (e) => {
  setDeviceName(e.target.value);
};
searchButton.onclick = (e) => {
  sendDiscovery(true);
};

server.on("message", (msg, rinfo) => {
  if (rinfo.port != discoveryPort) return;

  let data = JSON.parse(msg.toString());

  if (!("name" in data && "requestDiscovery" in data)) {
    console.log("Invalid message:", data);
    return;
  }

  if (data.name == "default") {
    console.log("Invalid message:", data);
    return;
  }

  window.discovered.set(rinfo.address, data.name);
  generateDevicesTable();
  console.log(`Discovered ${data.name} at ${rinfo.address}`);

  if (!data.requestDiscovery) return;

  console.log(`Sending discovery response to ${data.name}`);
  sendDiscovery(false, rinfo.address);
});

let devicesTable = document.getElementById("devices-table");
function generateDevicesTable() {
  devicesTable.innerHTML = "";

  for (let [ip, name] of window.discovered) {
    let row = document.createElement("tr");
    row.innerHTML = `<td>${name}</td><td>${ip}</td>`;
    devicesTable.appendChild(row);
  }
}
