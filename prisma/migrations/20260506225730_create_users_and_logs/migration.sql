BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[User] (
    [id] INT NOT NULL IDENTITY(1,1),
    [fullName] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [phone] NVARCHAR(1000) NOT NULL,
    [address] NVARCHAR(1000),
    [nationalId] NVARCHAR(1000) NOT NULL,
    [idCardFront] NVARCHAR(1000),
    [idCardBack] NVARCHAR(1000),
    [profilePicture] NVARCHAR(1000),
    [password] NVARCHAR(1000) NOT NULL,
    [role] NVARCHAR(1000) NOT NULL CONSTRAINT [User_role_df] DEFAULT 'Admin',
    [isActive] BIT NOT NULL CONSTRAINT [User_isActive_df] DEFAULT 1,
    [isDeleted] BIT NOT NULL CONSTRAINT [User_isDeleted_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [User_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdBy] INT,
    [updatedAt] DATETIME2 NOT NULL,
    [lastModifiedBy] INT,
    CONSTRAINT [User_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [User_email_key] UNIQUE NONCLUSTERED ([email]),
    CONSTRAINT [User_phone_key] UNIQUE NONCLUSTERED ([phone]),
    CONSTRAINT [User_nationalId_key] UNIQUE NONCLUSTERED ([nationalId])
);

-- CreateTable
CREATE TABLE [dbo].[Log] (
    [id] INT NOT NULL IDENTITY(1,1),
    [action] NVARCHAR(1000) NOT NULL,
    [entity] NVARCHAR(1000) NOT NULL,
    [entityId] INT NOT NULL,
    [details] NVARCHAR(max),
    [userId] INT NOT NULL,
    [ipAddress] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Log_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Log_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- AddForeignKey
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_createdBy_fkey] FOREIGN KEY ([createdBy]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_lastModifiedBy_fkey] FOREIGN KEY ([lastModifiedBy]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Log] ADD CONSTRAINT [Log_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
