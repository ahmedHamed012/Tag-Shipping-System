BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[couriers] (
    [id] INT NOT NULL IDENTITY(1,1),
    [fullName] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000),
    [phone] NVARCHAR(1000) NOT NULL,
    [address] NVARCHAR(1000),
    [nationalId] NVARCHAR(1000),
    [idCardFront] NVARCHAR(1000),
    [idCardBack] NVARCHAR(1000),
    [drivingLicense] NVARCHAR(1000),
    [drivingLicenseFront] NVARCHAR(1000),
    [drivingLicenseBack] NVARCHAR(1000),
    [isActive] BIT NOT NULL CONSTRAINT [couriers_isActive_df] DEFAULT 1,
    [isDeleted] BIT NOT NULL CONSTRAINT [couriers_isDeleted_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [couriers_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [createdBy] INT,
    [updatedBy] INT,
    CONSTRAINT [couriers_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [couriers_email_key] UNIQUE NONCLUSTERED ([email]),
    CONSTRAINT [couriers_phone_key] UNIQUE NONCLUSTERED ([phone]),
    CONSTRAINT [couriers_nationalId_key] UNIQUE NONCLUSTERED ([nationalId])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [couriers_phone_idx] ON [dbo].[couriers]([phone]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [couriers_fullName_idx] ON [dbo].[couriers]([fullName]);

-- AddForeignKey
ALTER TABLE [dbo].[shipments] ADD CONSTRAINT [shipments_courierId_fkey] FOREIGN KEY ([courierId]) REFERENCES [dbo].[couriers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[couriers] ADD CONSTRAINT [couriers_createdBy_fkey] FOREIGN KEY ([createdBy]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[couriers] ADD CONSTRAINT [couriers_updatedBy_fkey] FOREIGN KEY ([updatedBy]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
