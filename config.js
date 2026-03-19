// ============================================================
//  CẤU HÌNH GOOGLE SHEETS API
//  Xem SETUP.md để biết cách lấy các giá trị bên dưới
// ============================================================

const CONFIG = {
  // Lấy từ Google Cloud Console -> APIs & Services -> Credentials
  API_KEY: 'AIzaSyCVNbNzZJTYl9HxKjotkMY4idI8J318Z-w',
  CLIENT_ID: '764283131262-u4u6k2os4ht2ls74n50jl64kos3q9tun.apps.googleusercontent.com',

  // Lấy từ URL của Google Sheet:
  // https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
  SPREADSHEET_ID: '1QPsdxG5ICjCv6JzjpHxb4mh_7dD7U1p0sfQEuwddPFo',

  // Tên sheet (tab) trong Google Sheet
  SHEET_NAME: 'THUCHI',

  // Không cần thay đổi
  DISCOVERY_DOC: 'https://sheets.googleapis.com/$discovery/rest?version=v4',
  SCOPES: 'https://www.googleapis.com/auth/spreadsheets',
};
