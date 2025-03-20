const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const app = express();

mongoose
  .connect("mongodb://192.168.1.8:27017/productDB")
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

app.use(express.json());
app.use(cors());

// Schema sản phẩm (đã sửa theo đề bài)
const ProductSchema = new mongoose.Schema({
  idsanpham: { type: String, required: true, unique: true, trim: true }, // ID tự tạo
  loaisp: { type: String, required: true, trim: true }, // Loại sản phẩm
  gia: { type: Number, required: true, min: 1 }, // Giá
  hinhanh: { type: String, default: "" }, // Hình ảnh
});

const Product = mongoose.model("Product", ProductSchema);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}
app.use("/uploads", express.static("uploads"));

// API lấy danh sách sản phẩm
app.get("/products", async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: "Lỗi khi lấy danh sách sản phẩm" });
  }
});

app.post("/add-products", upload.single("hinhanh"), async (req, res) => {
  try {
    console.log("📥 Dữ liệu nhận từ frontend:", req.body);
    console.log("📸 Ảnh nhận được:", req.file);

    const { idsanpham, loaisp, gia } = req.body;
    if (!idsanpham || !loaisp || !gia || !req.file) {
      return res.status(400).json({ error: "Vui lòng nhập đầy đủ thông tin" });
    }

    const existingProduct = await Product.findOne({ idsanpham });
    if (existingProduct) {
      return res.status(400).json({ error: "ID sản phẩm đã tồn tại" });
    }

    const newProduct = new Product({
      idsanpham,
      loaisp,
      gia,
      hinhanh: req.file.filename, // Lưu tên file ảnh
    });

    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (error) {
    console.error("❌ Lỗi server:", error);
    res.status(500).json({ error: "Lỗi khi thêm sản phẩm" });
  }
});

// API xóa sản phẩm (Tìm bằng idsanpham thay vì _id của MongoDB)
app.delete("/products/:idsanpham", async (req, res) => {
  try {
    const product = await Product.findOneAndDelete({
      idsanpham: req.params.idsanpham,
    });
    if (!product) {
      return res.status(404).json({ error: "Sản phẩm không tồn tại" });
    }
    res.json({ message: "🗑️ Xóa sản phẩm thành công" });
  } catch (error) {
    res.status(500).json({ error: "Lỗi khi xóa sản phẩm" });
  }
});
app.put("/products-update/:id", async (req, res) => {
  try {
    const { idsanpham, loaisp, gia, hinhanh } = req.body;
    const { id } = req.params; // Lấy _id từ URL params

    console.log("🆔 ID từ params:", id);
    console.log("📥 Dữ liệu từ body:", req.body);

    let updateFields = {};
    if (idsanpham) updateFields.idsanpham = idsanpham;
    if (loaisp) updateFields.loaisp = loaisp;
    if (gia) updateFields.gia = gia;
    if (hinhanh) updateFields.hinhanh = hinhanh;

    console.log("📝 Trường cần cập nhật:", updateFields);

    // Kiểm tra nếu không có dữ liệu cập nhật
    if (Object.keys(updateFields).length === 0) {
      return res
        .status(400)
        .json({ error: "Không có thông tin nào để cập nhật" });
    }

    // Cập nhật sản phẩm theo _id
    const updatedProduct = await Product.findByIdAndUpdate(
      id, // Tìm theo _id
      { $set: updateFields },
      { new: true } // Trả về sản phẩm sau khi cập nhật
    );

    if (!updatedProduct) {
      return res.status(404).json({ error: "Sản phẩm không tồn tại" });
    }

    console.log("✅ Cập nhật thành công:", updatedProduct);
    res.json(updatedProduct);
  } catch (error) {
    console.error("❌ Lỗi server:", error);
    res.status(500).json({ error: "Lỗi khi cập nhật sản phẩm" });
  }
});

app.listen(3000, () => console.log("🚀 Server running on port 3000"));
