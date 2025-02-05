class apiSuccess {
    constructor(status, data, message = "Success"){
        this.status = status;
        this.data = data,
        this.message = message;
        this.success = statusCode < 400;
    }
}

export default apiSuccess;