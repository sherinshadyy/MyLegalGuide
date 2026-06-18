import pymysql

try:
    conn = pymysql.connect(
        host="localhost",
        user="root",
        password="",
        database="mylegalguide",
        port=3306
    )

    print("✅ تم الاتصال بقاعدة البيانات بنجاح")

    conn.close()

except Exception as e:
    print("❌ خطأ:")
    print(e)