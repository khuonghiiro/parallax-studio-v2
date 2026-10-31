import { installRemoteWebApiBridge } from './remoteWebApiBridge'

// Khởi chạy sớm trước mọi import UI/Store để đảm bảo window.api và crypto.randomUUID luôn sẵn sàng trên thiết bị LAN HTTP/HTTPS.
installRemoteWebApiBridge()
