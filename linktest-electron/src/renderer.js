const udp = require("dgram");

const discoveryPort = 42069;
const addrMulticast = "229.124.251.222"; // some random class D address lmao

window.discovered = new Map();

var deviceNameInput = document.getElementById("device-name");
var searchButton = document.getElementById("search-button");

function setDeviceName(name) {
  localStorage.setItem("deviceName", name);
}
function getDeviceName() {
  let deviceName = localStorage.getItem("deviceName");
  if (deviceName == null) {
    localStorage.setItem(deviceName, "default");
    deviceName = "default";
  }

  deviceNameInput.value = deviceName;

  if (deviceName == "") {
    return "default";
  }
  return deviceName;
}

getDeviceName();

var server = udp.createSocket("udp4");
server.bind(discoveryPort, () => {
  server.setBroadcast(true);
  server.setMulticastTTL(128);
  server.addMembership(addrMulticast);
});

server.on("error", (err) => {
  console.log(`Server error:\n${err.stack}`);
  server.close();
});

function sendDiscovery(requestDiscovery) {
  let sendObj = {
    name: getDeviceName(),
    requestDiscovery: requestDiscovery,
  };
  console.log(`Sending discovery:\n${JSON.stringify(sendObj)}`);

  let sendStr = JSON.stringify(sendObj);
  server.send(sendStr, discoveryPort, addrMulticast);
}

deviceNameInput.onkeyup = (e) => {
  setDeviceName(deviceNameInput.value);
  sendDiscovery(true);
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
  console.log(
    `Discovered "${data.name}" at ${rinfo.address}, requesting discovery ${data.requestDiscovery}`
  );

  if (!data.requestDiscovery) return;

  if (data.name == getDeviceName()) {
    console.log(`Device requesting discovery is me, weon't send response`);
    return;
  }

  console.log(`Sending discovery response to ${data.name}`);
  sendDiscovery(false);
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

window.onload = () => sendDiscovery(true);
