// const express = require('express');
// const cors = require('cors'); // นำเข้า cors
// const app = express();
// const axios = require('axios');

// app.use(cors()); // เปิดการใช้งาน CORS

// app.use(express.json()); // แปลง request body ที่ได้จาก
// app.use(express.static('frontend')); // ถ้าคุณเก็บไฟล์ไว้ในโฟลเดอร์ public

const bodyParser = require('body-parser');
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());  // Enable CORS for all routes

app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend'))); // For serving static files


const droneconfigserver = 'https://script.google.com/macros/s/AKfycbzwclqJRodyVjzYyY-NTQDb9cWG6Hoc5vGAABVtr5-jPA_ET_2IasrAJK4aeo5XoONiaA/exec'
const dronelogserver = 'https://app-tracking.pockethost.io/api/collections/drone_logs/records'


app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));





app.get("/configs/:id", (req, res) => {

    const id = Number(req.params.id);
  
    axios
      .get(droneconfigserver)
      .then((response) => {
        const data = response.data.data;
  
        const drone = data.find((d) => d.drone_id === id);
  
        if (!drone) {
          return res.status(404).send({ error: "drone_id not found" });
        }
  
        if (drone.max_speed == null) {
          drone.max_speed = 100;
        } else if (drone.max_speed > 110) {
          drone.max_speed = 110;
        }
  
        res.send({
          drone_id: drone.drone_id,
          drone_name: drone.drone_name,
          light: drone.light,
          country: drone.country,
          max_speed: drone.max_speed,
          population: drone.population,
        });
      })
      .catch((error) => {
        console.error("Error fetching data:", error);
        res.status(500).send("Error fetching data");
      });
  });
  /*app.get("/GET", (req, res) => {
    axios
      .get(droneconfigserver)
      .then((response) => {
        let data = response.data.headers;
  
        if (!data.max_speed) {
          data.max_speed = 100;
        } else if (data.max_speed > 110) {
          data.max_speed = 110;
        }
        res.send(data);
      })
      .catch((error) => {
        console.error("Error fetching data:", error);
        res.status(500).send("Error fetching data");
      });
  });*/
app.get('/status/:id', async (req, res) => {
    const droneId = Number(req.params.id); // ดึง drone_id จาก URL
    try {
        const response = await axios.get(droneconfigserver); // ส่ง GET request ไปยัง Drone Log Server
        const droneStatusData = response.data.data; // ดึงข้อมูลสถานะจากเซิร์ฟเวอร์

        // ค้นหาสถานะของโดรนตาม droneId
        const droneStatus = droneStatusData.find(status => status.drone_id === droneId);

        if (droneStatus) {
            res.json({ condition: droneStatus.condition || "unknown" }); // ส่งคืนสถานะของโดรน
        } else {
            res.status(404).json({ message: "Drone status not found" }); // หากไม่พบสถานะ
        }
        res.send(droneStatus)
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error" }); // จัดการข้อผิดพลาด
    }
});


// app.get('/logs/:id', async (req, res) => {
//     const drone_logs = req.params.id;
//     try{        
//     const url =  `${dronelogserver}?sort=-created&filter=(drone_id=${droneID}) `;
//     // const response = await axios.get(dronelogserver)
//     const response = await axios.get(url);
//     let dronegetlogs = response.data.items
//     es.json(dronegetlogs)
//        }
        
//         catch (error){
//             console.error(error) 
//             res.status(500).json({ message : "Error"})
//             }
    
//         })


app.get('/logs', async (req, res) => {
  try {
      const { page = 1, pageSize = 20 } = req.query; // Default to page 1 and 20 items per page
      let allLogs = [];
      let currentPage = 1;
      let hasMorePages = true;

      // การดึงข้อมูล log ทั้งหมดจาก API(เนื่องจากข้อมูลมีมากกว่า 1 หน้า)
      while (hasMorePages) {
          const response = await axios.get(`https://app-tracking.pockethost.io/api/collections/drone_logs/records?page=${currentPage}`);
          const logs = response.data.items;

          if (!logs || logs.length === 0) {
              hasMorePages = false;
          } else {
              allLogs = allLogs.concat(logs);
              currentPage++;
          }
      }

      // การคัดกรองและเรียงลำดับข้อมูล log(เรียงตามเวลา ล่าสุดขึ้นก่อน)
      const filteredLogs = allLogs.filter(log =>
          log.created && log.country && log.drone_id && log.drone_name && log.celsius
      );

      const sortedLogs = filteredLogs.sort((a, b) => new Date(b.created) - new Date(a.created));

      // การแบ่งหน้า
      const startIndex = (page - 1) * pageSize;
      const paginatedLogs = sortedLogs.slice(startIndex, startIndex + pageSize);

      // การส่งข้อมูลกลับไปยัง user
      res.json({ logs: paginatedLogs, total: sortedLogs.length });
  } catch (error) {
      console.error('Error fetching logs:', error);
      res.status(500).send('Error fetching logs');
  }
});
app.post('/logs', async (req, res) => {
    try {
    // ดึงข้อมูลจาก request body ที่ลูกค้าส่งมาผ่าน post
    const logData = req.body;

        // ตรวจสอบว่ามีข้อมูลใน logData หรือไม่
        if (!logData || Object.keys(logData).length === 0) {
          return res.status(400).json({ message: "No log data provided"
          });
          

        }
        
    // ส่งข้อมูลไปยัง Drone Log Server โดยใช้ POST request
    const response = await axios.post(dronelogserver, logData, {
        headers: {
            'Content-Type': 'application/json' // ตั้งค่า header เพื่อบอกว่าข้อมูลที่ลูกค้าส่งมาและส่งให้ server เป็น json
            //ต้องตั้งค่า header เพราะ เซิร์ฟเวอร์อาจไม่สามารถเข้าใจได้ว่าข้อมูลที่ส่งมานั้นมีรูปแบบเป็นอย่างไร ทำให้ไม่สามารถประมวลผลได้ถูกต้อง
                    }
                });
        
                // รับข้อมูลตอบกลับจากเซิร์ฟเวอร์และส่งกลับไปยังลูกค้า
                let dronepostlogs = response.data;
                res.json(dronepostlogs);
            } catch (error) {
                console.error(error);
                res.status(500).json({ message: "Error" }); // กรณีเกิดข้อผิดพลาด
            }
        });
// app.listen(port, () => {

//   console.log(`Example app listening on port ${port}`)
// })



app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'drone1.html'));
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
