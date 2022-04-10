const udp = require("dgram");
const ip = require("ip");

const discoveryPort = 42069;
window.discovered = new Map();

var deviceNameInput = document.getElementById("device-name");
function setDeviceName(name) {
  localStorage.setItem("deviceName", name);
}
function getDeviceName() {
  return localStorage.getItem("deviceName") || "default";
}

var server = udp.createSocket("udp4");
server.on("error", (err) => {
  console.log(`Server error:\n${err.stack}`);
  server.close();
});

function sendDiscovery(requestDiscovery, addrses) {
  let sendObj = {
    name: getDeviceName(),
    ip: ip.address(),
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
  sendDiscovery(true);
};

server.on("message", (msg, rinfo) => {
  if (rinfo.port != discoveryPort) return;

  let data = msg.toJSON();

  if (!("name" in data && "ip" in data && "requestDiscovery" in data)) {
    console.log("Invalid message:", data);
    return;
  }

  if (data.name == "default") {
    console.log("Invalid message:", data);
    return;
  }

  window.discovered.set(data.name, data.ip);
  generateDevicesTable();
  console.log(`Discovered ${data.name} at ${data.ip}`);

  if (!data.requestDiscovery) return;

  console.log(`Sending discovery response to ${data.name}`);
  sendDiscovery(false, rinfo.address);
});

let devicesTable = document.getElementById("devices-table");
function generateDevicesTable() {
  devicesTable.innerHTML = "";

  for (let [name, ip] of window.discovered) {
    let row = document.createElement("tr");
    row.innerHTML = `<td>${name}</td><td>${ip}</td>`;
    devicesTable.appendChild(row);
  }
}
