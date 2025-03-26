const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt"); // Thêm bcrypt để mã hóa mật khẩu
const app = express();

mongoose
  .connect("mongodb://10.60.31.204:27017/productDB")
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

app.use(express.json());
app.use(cors());

// Schema sản phẩm
const ProductSchema = new mongoose.Schema({
  tensp: { type: String, required: true, unique: true, trim: true },
  loaisp: { type: String, required: true, trim: true },
  gia: { type: Number, required: true, min: 1 },
  hinhanh: { type: String, default: "" },
});

const Product = mongoose.model("Product", ProductSchema);

// Schema người dùng
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  agreeToTerms: { type: Boolean, required: true },
});

const User = mongoose.model("User", UserSchema);

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

    const { tensp, loaisp, gia } = req.body;
    if (!tensp || !loaisp || !gia || !req.file) {
      return res
        .status(400)
        .json({ error: "Vui lòng nhập đầy đủ thông tin, bao gồm ảnh" });
    }

    const giaNumber = Number(gia);
    if (isNaN(giaNumber) || giaNumber < 1) {
      return res.status(400).json({ error: "Giá phải là một số lớn hơn 0" });
    }

    const existingProduct = await Product.findOne({ tensp });
    if (existingProduct) {
      return res.status(400).json({ error: "Tên sản phẩm đã tồn tại" });
    }

    const newProduct = new Product({
      tensp,
      loaisp,
      gia: giaNumber,
      hinhanh: req.file.filename,
    });

    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (error) {
    console.error("❌ Lỗi server:", error);
    res.status(500).json({ error: "Lỗi khi thêm sản phẩm" });
  }
});

// API xóa sản phẩm
app.delete("/products/:id", async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Sản phẩm không tồn tại" });
    }
    res.json({ message: "🗑️ Xóa sản phẩm thành công" });
  } catch (error) {
    res.status(500).json({ error: "Lỗi khi xóa sản phẩm" });
  }
});

app.put("/products-update/:id", upload.single("hinhanh"), async (req, res) => {
  try {
    const { tensp, loaisp, gia } = req.body;
    const { id } = req.params;

    console.log("🆔 ID từ params:", id);
    console.log("📥 Dữ liệu từ body:", req.body);
    console.log("📸 File upload:", req.file);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID sản phẩm không hợp lệ" });
    }

    let updateFields = {};
    if (tensp?.trim()) updateFields.tensp = tensp.trim();
    if (loaisp?.trim()) updateFields.loaisp = loaisp.trim();
    if (gia !== undefined && gia !== "") {
      const giaNumber = Number(gia);
      if (isNaN(giaNumber) || giaNumber < 1) {
        return res.status(400).json({ error: "Giá phải là một số lớn hơn 0" });
      }
      updateFields.gia = giaNumber;
    }
    if (req.file) updateFields.hinhanh = req.file.filename;

    console.log("📝 Trường cần cập nhật:", updateFields);

    if (Object.keys(updateFields).length === 0) {
      return res
        .status(400)
        .json({ error: "Không có thông tin nào để cập nhật" });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true }
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

// API đăng ký người dùng
app.post("/signup", async (req, res) => {
  try {
    const { name, email, password, repeatPassword, agreeToTerms } = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (
      !name ||
      !email ||
      !password ||
      !repeatPassword ||
      agreeToTerms === undefined
    ) {
      return res.status(400).json({ error: "Vui lòng nhập đầy đủ thông tin" });
    }

    if (password !== repeatPassword) {
      return res.status(400).json({ error: "Mật khẩu không khớp" });
    }

    if (!agreeToTerms) {
      return res
        .status(400)
        .json({ error: "Bạn phải đồng ý với điều khoản dịch vụ" });
    }

    // Kiểm tra email đã tồn tại chưa
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email đã được sử dụng" });
    }

    // Mã hóa mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);

    // Tạo người dùng mới
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      agreeToTerms,
    });

    await newUser.save();
    res.status(201).json({ message: "Đăng ký thành công" });
  } catch (error) {
    console.error("❌ Lỗi khi đăng ký:", error);
    res.status(500).json({ error: "Lỗi khi đăng ký người dùng" });
  }
});

// API đăng nhập người dùng
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Vui lòng nhập đầy đủ thông tin" });
    }

    const user = await User.findOne({ email }); // Tìm người dùng bằng email thay vì name
    if (!user) {
      return res.status(400).json({ error: "Email không tồn tại" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: "Mật khẩu không đúng" });
    }

    res.status(200).json({
      message: "Đăng nhập thành công",
      user: { name: user.name, email: user.email },
    });
  } catch (error) {
    console.error("❌ Lỗi khi đăng nhập:", error);
    res.status(500).json({ error: "Lỗi khi đăng nhập" });
  }
});

app.listen(3000, () => console.log("🚀 Server running on port 3000"));
