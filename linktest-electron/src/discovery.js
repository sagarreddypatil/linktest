const udp = require("dgram");
const ping = require("ping");
const Net = require("net");
const { runInThisContext } = require("vm");

const discoveryPort = 8080; // UDP
const speedtestPort = 8080; // TCP, that's why they're the same port
const addrMulticast = "239.255.23.55"; // some random class D address lmao
const chunkSize = 1; // KiB
const testDuration = 5.0; // seconds

window.discovered = new Map();

/* ============= Misc ============= */
function logDiscovery(msg) {
  console.log(`[DISCOVERY] ${msg}`);
}

function logSpeedtestClient(msg) {
  console.log(`[SPEEDTEST Client] ${msg}`);
}

function logSpeedtestServer(msg) {
  console.log(`[SPEEDTEST Server] ${msg}`);
}

function logUDP(msg) {
  console.log(`[UDP] ${msg}`);
}

/* ============= Textbox Things ============= */
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

/* ============= UDP Stuff ============= */
var server = udp.createSocket("udp4");
server.bind(discoveryPort, () => {
  server.setBroadcast(true);
  server.setMulticastTTL(128);
  server.addMembership(addrMulticast);
});

server.on("error", (err) => {
  logUDP(`Server error:\n${err.stack}`);
  server.close();
});

/* ============= Actual discovery Stuff ============= */
function sendDiscovery(requestDiscovery) {
  let sendObj = {
    name: getDeviceName(),
    requestDiscovery: requestDiscovery,
  };
  logDiscovery(`Sending discovery:\n${JSON.stringify(sendObj)}`);

  let sendStr = JSON.stringify(sendObj);
  server.send(sendStr, discoveryPort, addrMulticast);
}

function onNewIP(ip) {
  ping.promise.probe(ip).then((res) => {
    let speed = Math.round(res.avg);

    let curr = window.discovered.get(ip);
    curr.ping = speed;
    window.discovered.set(ip, curr);

    generateDevicesTable();
  });
}

server.on("message", (msg, rinfo) => {
  let data = JSON.parse(msg.toString());

  if (!("name" in data && "requestDiscovery" in data)) {
    logDiscovery("Invalid message:", data);
    return;
  }

  if (data.name == "default") {
    logDiscovery("Invalid message:", data);
    return;
  }

  if (!window.discovered.has(rinfo.address)) {
    window.discovered.set(rinfo.address, { name: data.name });
    onNewIP(rinfo.address);
  } else {
    let curr = window.discovered.get(rinfo.address);
    curr.name = data.name;
    window.discovered.set(rinfo.address, curr);
  }

  generateDevicesTable();
  logDiscovery(
    `Discovered "${data.name}" at ${rinfo.address}, requesting discovery ${data.requestDiscovery}`
  );

  if (!data.requestDiscovery) return;

  if (data.name == getDeviceName()) {
    logDiscovery(`Device requesting discovery is me, won't send response`);
    return;
  }

  logDiscovery(`Sending discovery response to ${data.name}`);
  sendDiscovery(false);
});

/* ============= TCP Stuff ============= */
const tcpServer = new Net.Server();
let busy = false; // only one client can speedtest at a time

tcpServer.listen({ port: speedtestPort, host: "0.0.0.0" }, () => {
  logSpeedtestServer(`TCP server listening on port ${speedtestPort}`);
});

tcpServer.on("connection", (socket) => {
  let clientIP = socket.remoteAddress;
  let clientName = window.discovered.get(clientIP).name;
  if (!clientName) {
    logSpeedtestServer(`Unknown client "${clientIP}", closing connection`);
    socket.end();
  }
  if (busy) {
    logSpeedtestServer(
      `Client "${clientName}" tried to speedtest while busy, closing connection`
    );
    socket.end();
  }

  busy = true;
  logSpeedtestServer(`Client "${clientName}" connected`);

  socket.on("data", (chunk) => {
    logSpeedtestServer(`Received data from ${clientName}: ${chunk.toString()}`);
  });

  socket.on("end", () => {
    logSpeedtestServer(`Client "${clientName}" disconnected`);
    busy = false;
  });
});

/* ============= Speedtest Stuff ============= */
function linktest(ip) {
  let client = Net.connect({ port: speedtestPort, host: ip }, () => {
    logSpeedtestClient(`Connected to "${window.discovered.get(ip).name}"`);
    doTheSpeedtest(client);
    logSpeedtestClient(`Speedtest done`);
    socket.end();
  });
}

async function doTheSpeedtest(socket) {
  let thiccObject = "A".repeat(1024 * chunkSize);
  let start = Date.now();

  while (Date.now() - start < testDuration * 1000) {
    socket.write(thiccObject);
  }
}

/* ============= Bindings ============= */
deviceNameInput.onkeyup = (e) => {
  setDeviceName(deviceNameInput.value);
  sendDiscovery(true);
};
searchButton.onclick = (e) => {
  sendDiscovery(true);
};

/* ============= Table Generation ============= */
let devicesTable = document.getElementById("devices-table");
function generateDevicesTable() {
  devicesTable.innerHTML = "";

  for (let [ip, props] of window.discovered) {
    let row = document.createElement("tr");
    let pingTime = props.ping;

    let nameCell = document.createElement("td");
    nameCell.innerText = props.name;
    row.appendChild(nameCell);

    let ipCell = document.createElement("td");
    ipCell.innerText = ip;
    row.appendChild(ipCell);

    let pingCell = document.createElement("td");
    pingCell.innerText = pingTime == undefined ? "N/A" : pingTime + " ms";
    row.appendChild(pingCell);

    let testCell = document.createElement("td");
    let testButton = document.createElement("button");
    testButton.innerText = "Test";
    testButton.onclick = () => setTimeout(() => linktest(ip), 0);
    testCell.appendChild(testButton);
    row.appendChild(testCell);

    let speedCell = document.createElement("td");
    speedCell.innerText = "Untested";
    row.appendChild(speedCell);

    devicesTable.appendChild(row);
  }
}

window.onload = () => sendDiscovery(true);
